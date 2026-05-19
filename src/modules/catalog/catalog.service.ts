import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CatalogProduct, CatalogProductStatus, CatalogVariant } from './entities/catalog-product.entity';
import { ShopProduct } from './entities/shop-product.entity';
import { Product, ProductSource } from '../products/entities/product.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Category } from '../categories/entities/category.entity';
import { Unit } from '../units/entities/unit.entity';
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

  async review(id: string, dto: ReviewCatalogProductDto, userId: string) {
    const product = await this.findOne(id);
    if (product.status !== CatalogProductStatus.PENDING) {
      throw new BadRequestException('Only pending products can be reviewed');
    }
    product.status = dto.status;
    if (dto.status === CatalogProductStatus.APPROVED) {
      product.approvedBy = userId;
      product.rejectionReason = null;
    } else {
      product.rejectionReason = dto.rejectionReason;
    }
    return this.catalogProductRepo.save(product);
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
        hasVariants: catalogProduct.variants?.length > 0,
      });
      const savedProduct = await qr.manager.save(product);

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
}
