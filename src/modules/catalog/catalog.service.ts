import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CatalogProduct, CatalogProductStatus, CatalogVariant } from './entities/catalog-product.entity';
import { ShopProduct } from './entities/shop-product.entity';
import { Product, ProductSource } from '../products/entities/product.entity';
import { ProductVariant, ProductStatus } from '../products/entities/product-variant.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Category } from '../categories/entities/category.entity';
import { Unit } from '../units/entities/unit.entity';
import { Shop } from '../shops/entities/shop.entity';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import {
  CatalogFilterDto,
  CreateCatalogProductDto,
  ImportCatalogProductDto,
  ReviewCatalogProductDto,
  SuggestCatalogProductDto,
  UpdateCatalogProductDto,
} from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CatalogProduct)
    private catalogProductRepo: Repository<CatalogProduct>,
    @InjectRepository(CatalogVariant)
    private catalogVariantRepo: Repository<CatalogVariant>,
    @InjectRepository(ShopProduct)
    private shopProductRepo: Repository<ShopProduct>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(Brand)
    private brandRepo: Repository<Brand>,
    @InjectRepository(Category)
    private categoryRepo: Repository<Category>,
    @InjectRepository(Unit)
    private unitRepo: Repository<Unit>,
    @InjectRepository(Shop)
    private shopRepo: Repository<Shop>,
    @InjectRepository(ProductVariant)
    private variantRepo: Repository<ProductVariant>,
    @InjectRepository(InventoryItem)
    private inventoryRepo: Repository<InventoryItem>,
    private dataSource: DataSource,
  ) {}

  private buildCatalogQb() {
    return this.catalogProductRepo
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.variants', 'v')
      .leftJoin(Brand,    'brand',    'brand.id = cp.brandId')
      .leftJoin(Category, 'category', 'category.id = cp.categoryId')
      .leftJoin(Unit,     'unit',     'unit.id = cp.unitId')
      .addSelect('brand.name',    'brandName')
      .addSelect('category.name', 'categoryName')
      .addSelect('unit.name',     'unitName');
  }

  private async attachFlatFields(products: CatalogProduct[]): Promise<any[]> {
    if (!products.length) return [];

    const brandIds    = [...new Set(products.map(p => p.brandId).filter(Boolean))];
    const categoryIds = [...new Set(products.map(p => p.categoryId).filter(Boolean))];
    const unitIds     = [...new Set(products.map(p => p.unitId).filter(Boolean))];

    const [brands, categories, units] = await Promise.all([
      brandIds.length    ? this.brandRepo.findByIds(brandIds)       : [],
      categoryIds.length ? this.categoryRepo.findByIds(categoryIds) : [],
      unitIds.length     ? this.unitRepo.findByIds(unitIds)         : [],
    ]);

    const brandMap    = Object.fromEntries(brands.map(b    => [b.id, b.name]));
    const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    const unitMap     = Object.fromEntries(units.map(u     => [u.id, u.name]));

    return products.map(p => ({
      ...p,
      brandName:    brandMap[p.brandId]    ?? null,
      categoryName: categoryMap[p.categoryId] ?? null,
      unitName:     unitMap[p.unitId]      ?? null,
    }));
  }

  async findAll(filters: CatalogFilterDto) {
    const { search, status, page = 1, limit = 20 } = filters;
    const qb = this.catalogProductRepo.createQueryBuilder('cp').leftJoinAndSelect('cp.variants', 'v');

    if (search) qb.andWhere('cp.name ILIKE :search', { search: `%${search}%` });
    qb.andWhere('cp.status = :status', { status: status ?? CatalogProductStatus.APPROVED });

    const total = await qb.getCount();
    const raw = await qb.orderBy('cp.name', 'ASC').skip((page - 1) * limit).take(limit).getMany();
    const data = await this.attachFlatFields(raw);
    return { data, message: 'Catalog products fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const product = await this.catalogProductRepo.findOne({ where: { id }, relations: ['variants'] });
    if (!product) throw new NotFoundException('Catalog product not found');
    const [withFields] = await this.attachFlatFields([product]);
    return withFields;
  }

  async create(dto: CreateCatalogProductDto, userId: string) {
    const product = this.catalogProductRepo.create({ ...dto, status: CatalogProductStatus.APPROVED, approvedBy: userId });
    return this.catalogProductRepo.save(product);
  }

  async update(id: string, dto: UpdateCatalogProductDto) {
    const product = await this.findOne(id);
    Object.assign(product, dto);
    return this.catalogProductRepo.save(product);
  }

  async suggest(dto: SuggestCatalogProductDto, userId: string) {
    const product = this.catalogProductRepo.create({ ...dto, status: CatalogProductStatus.PENDING, suggestedBy: userId });
    return this.catalogProductRepo.save(product);
  }

  // ── Fuzzy name match against approved catalog products ───────────────────────
  // How it works:
  //   1. Exact match first          — "Dal Masuro" === "Dal Masuro"
  //   2. Substring match            — catalog has "Dal Masuro (Lentils)", shop typed "Dal Masuro"
  //   3. Token overlap              — split both names into words, count shared words
  //      e.g. "Coca Cola 330ml Can" vs "coke can 330" → tokens: [cola, 330, can] = 3 shared → high score
  //   Returns up to 5 approved products sorted by descending similarity score (0–1).
  //   Only results with score >= 0.3 are returned to avoid noise.
  async getSimilar(name: string): Promise<any[]> {
    const candidates = await this.catalogProductRepo.find({
      where: { status: CatalogProductStatus.APPROVED },
      select: ['id', 'name', 'description', 'barcode', 'categoryId', 'brandId', 'unitId'],
    });

    const normalize = (s: string) =>
      s.toLowerCase()
       .replace(/[-_/\\]/g, ' ')   // hyphens/underscores → space so "Coca-Cola" → "coca cola"
       .replace(/[^a-z0-9\s]/g, '') // strip remaining special chars
       .replace(/\s+/g, ' ')
       .trim();
    const tokenize  = (s: string) => normalize(s).split(' ').filter(t => t.length > 1);

    const input       = normalize(name);
    const inputTokens = new Set(tokenize(name));

    const scored = candidates
      .map(cp => {
        const cpNorm   = normalize(cp.name);
        const cpTokens = tokenize(cp.name);

        // Exact match
        if (input === cpNorm) return { cp, score: 1.0 };

        // Substring match either way
        if (input.includes(cpNorm) || cpNorm.includes(input)) return { cp, score: 0.85 };

        // Token overlap: shared tokens / union of both token sets
        const shared = cpTokens.filter(t => inputTokens.has(t)).length;
        const union  = new Set([...inputTokens, ...cpTokens]).size;
        const score  = union > 0 ? shared / union : 0;

        return { cp, score };
      })
      .filter(r => r.score >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return await this.attachFlatFields(scored.map(r => r.cp));
  }

  // ── Auto-link or suggest when a shop creates a product manually ──────────────
  // Called from ProductsService after product creation.
  // Returns the catalogProductId if an exact/close match was found (so the caller
  // can update the product row), otherwise returns null after creating a suggestion.
  async autoLinkOrSuggest(
    dto: SuggestCatalogProductDto,
    userId: string,
    shopId: string,
    productId: string,
  ): Promise<string | null> {
    const similar = await this.getSimilar(dto.name);

    // First result with score 1.0 or very high confidence (exact / substring) → auto-link
    const candidates = await this.catalogProductRepo.find({
      where: { status: CatalogProductStatus.APPROVED },
      select: ['id', 'name'],
    });

    const normalize = (s: string) =>
      s.toLowerCase().replace(/[-_/\\]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const input = normalize(dto.name);

    const exactMatch = candidates.find(cp => {
      const cpNorm = normalize(cp.name);
      return input === cpNorm || input.includes(cpNorm) || cpNorm.includes(input);
    });

    if (exactMatch) {
      // Link the shop product to the existing catalog product
      await this.productRepo.update(productId, {
        catalogProductId: exactMatch.id,
        source: ProductSource.CATALOG,
      });
      // Create ShopProduct link if not already there
      const existing = await this.shopProductRepo.findOne({
        where: { shopId, catalogProductId: exactMatch.id },
      });
      if (!existing) {
        await this.shopProductRepo.save(
          this.shopProductRepo.create({ shopId, catalogProductId: exactMatch.id, productId }),
        );
      }
      return exactMatch.id;
    }

    // No match → create a pending suggestion
    await this.suggest(dto, userId);
    return null;
  }

  async review(id: string, dto: ReviewCatalogProductDto, userId: string) {
    const product = await this.findOne(id);
    if (product.status !== CatalogProductStatus.PENDING) {
      throw new BadRequestException('Only pending products can be reviewed');
    }
    // Attach similar products so super admin sees them in the response
    const similar = await this.getSimilar(product.name);
    product.status = dto.status;
    if (dto.status === CatalogProductStatus.APPROVED) {
      product.approvedBy = userId;
      product.rejectionReason = null;
    } else {
      product.rejectionReason = dto.rejectionReason;
    }
    const saved = await this.catalogProductRepo.save(product);
    return { data: saved, similar, message: `Product ${dto.status}` };
  }

  // Super admin links a pending suggestion to an existing catalog product instead
  // of approving it as a new one. All shop products that referenced the suggestion
  // are re-pointed to the existing catalog product and the suggestion is deleted.
  async linkSuggestion(suggestionId: string, catalogProductId: string) {
    const suggestion = await this.catalogProductRepo.findOne({ where: { id: suggestionId } });
    if (!suggestion) throw new NotFoundException('Suggestion not found');
    if (suggestion.status !== CatalogProductStatus.PENDING) {
      throw new BadRequestException('Only pending suggestions can be linked');
    }

    const target = await this.catalogProductRepo.findOne({ where: { id: catalogProductId, status: CatalogProductStatus.APPROVED } });
    if (!target) throw new NotFoundException('Target catalog product not found or not approved');

    // Re-point all shop products that were linked to this suggestion
    await this.productRepo.update(
      { catalogProductId: suggestionId },
      { catalogProductId, source: ProductSource.CATALOG },
    );

    // Create ShopProduct entries for any products now linked
    const linkedProducts = await this.productRepo.find({ where: { catalogProductId } });
    for (const p of linkedProducts) {
      const exists = await this.shopProductRepo.findOne({ where: { shopId: p.shopId, catalogProductId } });
      if (!exists) {
        await this.shopProductRepo.save(
          this.shopProductRepo.create({ shopId: p.shopId, catalogProductId, productId: p.id }),
        );
      }
    }

    // Delete the duplicate suggestion
    await this.catalogProductRepo.delete(suggestionId);

    return { data: target, message: `Suggestion linked to "${target.name}" and removed` };
  }

  async importToShop(dto: ImportCatalogProductDto, shopId: string, userId: string) {
    const catalogProduct = await this.findOne(dto.catalogProductId);
    if (catalogProduct.status !== CatalogProductStatus.APPROVED) {
      throw new BadRequestException('Only approved catalog products can be imported');
    }

    const existing = await this.shopProductRepo.findOne({ where: { shopId, catalogProductId: dto.catalogProductId } });
    if (existing) {
      // Return the existing shop product
      const product = await this.productRepo.findOne({ where: { id: existing.productId } });
      return { data: { shopProduct: existing, product }, message: 'Product already imported' };
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const product = this.productRepo.create({
        name: catalogProduct.name,
        description: catalogProduct.description,
        image: catalogProduct.image,
        categoryId: catalogProduct.categoryId,
        brandId: catalogProduct.brandId,
        unitId: catalogProduct.unitId,
        shopId,
        catalogProductId: catalogProduct.id,
        source: ProductSource.CATALOG,
        hasVariants: false,
      });
      const savedProduct = await qr.manager.save(product);

      const sku = catalogProduct.barcode
        ?? `${catalogProduct.name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 20)}-${Date.now()}`;

      const variant = await qr.manager.save(
        this.variantRepo.create({
          shopId,
          productId:     savedProduct.id,
          name:          catalogProduct.name,
          sku,
          barcode:       catalogProduct.barcode ?? null,
          status:        ProductStatus.ACTIVE,
          isDefault:     true,
          isActive:      true,
          minStockLevel: 0,
          trackInventory: true,
        }),
      );

      await qr.manager.save(
        this.inventoryRepo.create({
          shopId,
          productId:         savedProduct.id,
          variantId:         variant.id,
          quantityOnHand:    0,
          quantityAvailable: 0,
          quantityReserved:  0,
          averageCost:       0,
        }),
      );

      const shopProduct = this.shopProductRepo.create({ shopId, catalogProductId: catalogProduct.id, productId: savedProduct.id });
      const savedShopProduct = await qr.manager.save(shopProduct);

      await qr.commitTransaction();
      return { data: { shopProduct: savedShopProduct, product: savedProduct }, message: 'Product imported successfully' };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async getShopProducts(shopId: string) {
    const shopProducts = await this.shopProductRepo.find({ where: { shopId } });
    return { data: shopProducts, message: 'Shop products fetched successfully' };
  }

  // Super admin: list all shop products not linked to any catalog product
  async getUnlinkedProducts(filters: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = filters;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('p.catalogProductId IS NULL')
      .andWhere('p.deletedAt IS NULL');

    if (search) qb.andWhere('p.name ILIKE :search', { search: `%${search}%` });

    const total = await qb.getCount();
    const products = await qb
      .select(['p.id', 'p.name', 'p.description', 'p.shopId', 'p.source', 'p.createdAt'])
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    if (!products.length) {
      return { data: [], message: 'Unlinked products fetched', meta: buildPaginationMeta(total, page, limit) };
    }

    // Attach shopName and similar catalog suggestions for each product
    const shopIds = [...new Set(products.map(p => p.shopId).filter(Boolean))];
    const shops   = shopIds.length ? await this.dataSource.getRepository('Shop').find({ where: shopIds.map(id => ({ id })) }) : [];
    const shopMap = Object.fromEntries((shops as any[]).map(s => [s.id, s.name]));

    const data = await Promise.all(
      products.map(async p => ({
        ...p,
        shopName: shopMap[p.shopId] ?? null,
        similar:  await this.getSimilar(p.name),
      })),
    );

    return { data, message: 'Unlinked products fetched', meta: buildPaginationMeta(total, page, limit) };
  }

  // Super admin: manually link any shop product to a catalog product
  async linkProductToCatalog(productId: string, catalogProductId: string) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const catalogProduct = await this.catalogProductRepo.findOne({
      where: { id: catalogProductId, status: CatalogProductStatus.APPROVED },
    });
    if (!catalogProduct) throw new NotFoundException('Catalog product not found or not approved');

    await this.productRepo.update(productId, {
      catalogProductId,
      source: ProductSource.CATALOG,
    });

    // Create ShopProduct link if not already there
    const existing = await this.shopProductRepo.findOne({
      where: { shopId: product.shopId, catalogProductId },
    });
    if (!existing) {
      await this.shopProductRepo.save(
        this.shopProductRepo.create({ shopId: product.shopId, catalogProductId, productId }),
      );
    }

    return { data: { productId, catalogProductId }, message: `Product linked to "${catalogProduct.name}"` };
  }

  async getCatalogProductSalesStats(catalogProductId: string) {
    const result = await this.productRepo
      .createQueryBuilder('p')
      .innerJoin('p.saleItems', 'si')
      .innerJoin('si.sale', 's', "s.status != 'cancelled'")
      .where('p.catalogProductId = :catalogProductId', { catalogProductId })
      .select([
        'p.shopId as "shopId"',
        'COUNT(DISTINCT s.id) as "totalSales"',
        'SUM(si.quantity) as "totalQuantity"',
        'SUM(si.quantity * si.unitPrice) as "totalRevenue"',
      ])
      .groupBy('p.shopId')
      .getRawMany();

    return { data: result, message: 'Catalog product sales stats fetched successfully' };
  }

  // Returns approved catalog products for the given shopType, grouped by category
  async getOnboardingProducts(shopType: string) {
    const products = await this.catalogProductRepo.find({
      where: { status: CatalogProductStatus.APPROVED, shopType },
      relations: ['variants'],
      order: { name: 'ASC' },
    });

    const withFields = await this.attachFlatFields(products);

    // Group by categoryName
    const grouped: Record<string, any[]> = {};
    for (const p of withFields) {
      const cat = p.categoryName ?? 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }

    const data = Object.entries(grouped).map(([category, products]) => ({ category, products }));
    return { data, message: 'Onboarding products fetched successfully' };
  }

  // Bulk import: import multiple catalog products in one call
  // Skips already-imported products silently
  async bulkImport(catalogProductIds: string[], shopId: string, userId: string) {
    const results = { imported: [] as string[], skipped: [] as string[], failed: [] as string[] };

    for (const catalogProductId of catalogProductIds) {
      try {
        const catalogProduct = await this.catalogProductRepo.findOne({
          where: { id: catalogProductId, status: CatalogProductStatus.APPROVED },
          relations: ['variants'],
        });
        if (!catalogProduct) { results.failed.push(catalogProductId); continue; }

        const existing = await this.shopProductRepo.findOne({ where: { shopId, catalogProductId } });
        if (existing) { results.skipped.push(catalogProduct.name); continue; }

        const product = await this.productRepo.save(
          this.productRepo.create({
            name:             catalogProduct.name,
            description:      catalogProduct.description,
            image:            catalogProduct.image,
            categoryId:       catalogProduct.categoryId,
            brandId:          catalogProduct.brandId,
            unitId:           catalogProduct.unitId,
            shopId,
            catalogProductId: catalogProduct.id,
            source:           ProductSource.CATALOG,
            hasVariants:      false,
          }),
        );

        // Create default variant so product appears in /products/variants
        const sku = catalogProduct.barcode
          ?? `${catalogProduct.name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 20)}-${Date.now()}`;

        const variant = await this.variantRepo.save(
          this.variantRepo.create({
            shopId,
            productId:  product.id,
            name:       catalogProduct.name,
            sku,
            barcode:    catalogProduct.barcode ?? null,
            status:     ProductStatus.ACTIVE,
            isDefault:  true,
            isActive:   true,
            minStockLevel: 0,
            trackInventory: true,
          }),
        );

        // Create inventory item with zero stock — shop sets opening stock later
        await this.inventoryRepo.save(
          this.inventoryRepo.create({
            shopId,
            productId:         product.id,
            variantId:         variant.id,
            quantityOnHand:    0,
            quantityAvailable: 0,
            quantityReserved:  0,
            averageCost:       0,
          }),
        );

        await this.shopProductRepo.save(
          this.shopProductRepo.create({ shopId, catalogProductId, productId: product.id }),
        );

        results.imported.push(catalogProduct.name);
      } catch {
        results.failed.push(catalogProductId);
      }
    }

    return { data: results, message: `Imported ${results.imported.length} products` };
  }

  // Called after bulk import to mark onboarding as done
  async completeOnboarding(shopId: string) {
    await this.shopRepo.update(shopId, { onboardingCompleted: true });
    return { message: 'Onboarding completed' };
  }
}
