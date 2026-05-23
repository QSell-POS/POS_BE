import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { StorageService } from 'src/common/services/storage.service';

import { Product, ProductType } from 'src/modules/products/entities/product.entity';
import { PriceType, ProductPrice } from './entities/product-price.entity';
import { ProductVariant, ProductStatus } from './entities/product-variant.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryHistory, InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { Category } from '../categories/entities/category.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Unit } from '../units/entities/unit.entity';
import {
  CreateProductDto,
  CreateVariantDto,
  ProductFilterDto,
  UpdateProductDto,
  UpdateProductPriceDto,
  UpdateVariantDto,
} from './dto/product.dto';
import { BulkImportResult } from './dto/bulk-import.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { CatalogService } from '../catalog/catalog.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductPrice)
    private priceRepository: Repository<ProductPrice>,
    @InjectRepository(ProductVariant)
    private variantRepository: Repository<ProductVariant>,
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryBatch)
    private batchRepository: Repository<InventoryBatch>,
    @InjectRepository(Category)
    private categoryRepo: Repository<Category>,
    @InjectRepository(Brand)
    private brandRepo: Repository<Brand>,
    @InjectRepository(Unit)
    private unitRepo: Repository<Unit>,
    private dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly catalogService: CatalogService,
  ) {}

  async findAll(filters: ProductFilterDto, shopId: string) {
    const { search, categoryId, brandId, status, lowStock, page = 1, limit = 20 } = filters;

    const qb = this.productRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.unit', 'unit')
      .leftJoinAndSelect('p.variants', 'variant')
      .leftJoinAndSelect('p.inventoryItems', 'inv')
      .where('p.shopId = :shopId', { shopId })
      .andWhere('p.deletedAt IS NULL');

    if (search) {
      qb.andWhere('(p.name ILIKE :search OR variant.sku ILIKE :search OR variant.barcode ILIKE :search)', { search: `%${search}%` });
    }
    if (categoryId) qb.andWhere('p.categoryId = :categoryId', { categoryId });
    if (brandId) qb.andWhere('p.brandId = :brandId', { brandId });
    if (status) qb.andWhere('variant.status = :status', { status });
    if (lowStock) {
      qb.andWhere('inv.quantityAvailable <= variant.minStockLevel');
    }

    const total = await qb.getCount();
    const rawData = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.createdAt', 'DESC')
      .getMany();

    const data = rawData.map((p) => {
      const totalOnHand = (p.inventoryItems ?? []).reduce((sum, i) => sum + Number(i.quantityOnHand), 0);
      const totalReserved = (p.inventoryItems ?? []).reduce((sum, i) => sum + Number(i.quantityReserved), 0);
      const totalAvailable = (p.inventoryItems ?? []).reduce((sum, i) => sum + Number(i.quantityAvailable), 0);

      return {
        id: p.id,
        createdAt: p.createdAt,
        shopId: p.shopId,
        name: p.name,
        description: p.description,
        image: this.storage.resolveUrl(p.image),
        type: p.type,
        brandId: p.brandId,
        categoryId: p.categoryId,
        unitId: p.unitId,
        hasVariants: p.hasVariants,
        brand: p.brand?.name ?? null,
        category: p.category?.name ?? null,
        unit: p.unit?.symbol ?? null,
        inventory: {
          quantityOnHand: totalOnHand,
          quantityReserved: totalReserved,
          quantityAvailable: totalAvailable,
        },
      };
    });

    return {
      data,
      message: 'Products retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, shopId: string) {
    const product = await this.productRepository.findOne({
      where: { id, shopId },
      relations: ['brand', 'category', 'unit', 'prices', 'variants', 'inventoryItems'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findByBarcode(barcode: string, shopId: string) {
    const variant = await this.variantRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.product', 'p')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.unit', 'unit')
      .leftJoinAndSelect('p.prices', 'price', 'price.isCurrent = true')
      .leftJoinAndSelect('v.inventoryItems', 'inv')
      .where('v.barcode = :barcode AND v.shopId = :shopId', { barcode, shopId })
      .getOne();

    if (!variant) throw new NotFoundException('Product not found');

    const p = variant.product;
    const priceMap = (p?.prices ?? []).reduce(
      (acc, pr) => { acc[pr.priceType] = Number(pr.price); return acc; },
      {} as Record<string, number>,
    );

    // FIFO purchase price from batches
    const batch = await this.batchRepository
      .createQueryBuilder('b')
      .where('b.variantId = :vid AND b.quantityRemaining > 0', { vid: variant.id })
      .orderBy('b.createdAt', 'ASC')
      .getOne();

    return {
      id:            variant.id,
      productId:     variant.productId,
      productName:   p?.name ?? null,
      brand:         p?.brand?.name ?? null,
      category:      p?.category?.name ?? null,
      unit:          p?.unit?.symbol ?? null,
      name:          variant.name,
      sku:           variant.sku,
      barcode:       variant.barcode,
      image:         this.storage.resolveUrl(p?.image) ?? null,
      status:        variant.status,
      isDefault:     variant.isDefault,
      isActive:      variant.isActive,
      minStockLevel: variant.minStockLevel,
      maxStockLevel: variant.maxStockLevel,
      reorderPoint:  variant.reorderPoint,
      trackInventory: variant.trackInventory,
      attributes:    variant.attributes,
      retailPrice:   priceMap[PriceType.RETAIL] ?? null,
      purchasePrice: batch ? Number(batch.purchasePrice) : (priceMap[PriceType.PURCHASE] ?? null),
      wholesalePrice: priceMap[PriceType.WHOLESALE] ?? null,
      inventory:     variant.inventoryItems?.[0]
        ? {
            quantityOnHand:      variant.inventoryItems[0].quantityOnHand,
            quantityAvailable:   variant.inventoryItems[0].quantityAvailable,
            quantityReserved:    variant.inventoryItems[0].quantityReserved,
          }
        : null,
      createdAt: variant.createdAt,
    };
  }

  async getPriceHistory(productId: string, shopId: string) {
    const priceHistory = await this.priceRepository.find({
      where: { productId, shopId },
      order: { createdAt: 'DESC' },
    });

    return {
      data: priceHistory,
      message: 'Price history retrieved successfully',
    };
  }

  async getCurrentPrice(productId: string, priceType: PriceType, shopId: string): Promise<number> {
    const price = await this.priceRepository.findOne({
      where: { productId, priceType, isCurrent: true, shopId },
    });
    return price?.price ?? 0;
  }

  private resolveVariantName(productName: string, v: { name?: string; attributes?: Record<string, string> }, isMultiple: boolean): string {
    if (v.name) return v.name;
    if (!isMultiple) return productName;
    const attrValues = Object.values(v.attributes ?? {}).join(' ');
    return attrValues ? `${productName} ${attrValues}` : productName;
  }

  async create(dto: CreateProductDto, shopId: string, userId: string) {
    if (dto.variants.length === 0) throw new BadRequestException('At least one variant is required');

    const isMultiple = dto.variants.length > 1;
    if (isMultiple) {
      for (const v of dto.variants) {
        if (!v.attributes || Object.keys(v.attributes).length === 0) {
          throw new BadRequestException('Each variant must have at least one attribute when creating multiple variants');
        }
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const firstVariant = dto.variants[0];

      const product = queryRunner.manager.create(Product, {
        name: dto.name,
        description: dto.description,
        image: dto.image,
        type: dto.type,
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        unitId: dto.unitId,
        hasVariants: isMultiple,
        shopId,
      });
      const saved = await queryRunner.manager.save(Product, product);

      // Use first variant's prices for the product-level price history
      const prices: Partial<ProductPrice>[] = [];
      prices.push({
        productId: saved.id,
        priceType: PriceType.RETAIL,
        price: firstVariant.retailPrice,
        costPrice: firstVariant.purchasePrice,
        isCurrent: true,
        changedBy: userId,
        shopId,
      });

      if (firstVariant.purchasePrice) {
        prices.push({
          productId: saved.id,
          priceType: PriceType.PURCHASE,
          price: firstVariant.purchasePrice,
          isCurrent: true,
          changedBy: userId,
          shopId,
        });
      }

      if (firstVariant.wholesalePrice) {
        prices.push({
          productId: saved.id,
          priceType: PriceType.WHOLESALE,
          price: firstVariant.wholesalePrice,
          isCurrent: true,
          changedBy: userId,
          shopId,
        });
      }

      await queryRunner.manager.save(ProductPrice, prices);

      for (let i = 0; i < dto.variants.length; i++) {
        const v = dto.variants[i];
        const variantName = this.resolveVariantName(dto.name, v, isMultiple);

        const savedVariant = await queryRunner.manager.save(ProductVariant, {
          productId: saved.id,
          name: variantName,
          sku: v.sku,
          barcode: v.barcode,
          taxRate: v.taxRate ?? 0,
          status: dto.status ?? ProductStatus.ACTIVE,
          minStockLevel: v.minStockLevel ?? 0,
          maxStockLevel: v.maxStockLevel,
          reorderPoint: v.reorderPoint ?? 0,
          trackInventory: v.trackInventory ?? true,
          attributes: v.attributes,
          isDefault: i === 0,
          isActive: true,
          shopId,
        });

        if (dto.type !== 'service' && dto.type !== 'digital') {
          const qty = v.initialQuantity || 0;
          const inventoryItem = await queryRunner.manager.save(InventoryItem, {
            shopId,
            productId: saved.id,
            variantId: savedVariant.id,
            quantityOnHand: qty,
            quantityAvailable: qty,
            quantityReserved: 0,
            averageCost: v.purchasePrice || 0,
            lastRestockedAt: qty > 0 ? new Date() : null,
          });

          if (qty > 0) {
            await queryRunner.manager.save(InventoryHistory, {
              shopId,
              inventoryItemId: inventoryItem.id,
              productId: saved.id,
              variantId: savedVariant.id,
              movementType: InventoryMovementType.OPENING_STOCK,
              quantity: qty,
              quantityBefore: 0,
              quantityAfter: qty,
              unitCost: v.purchasePrice || 0,
              referenceType: 'opening_stock',
              notes: 'Initial stock on product creation',
            });

            await queryRunner.manager.save(InventoryBatch, {
              shopId,
              productId: saved.id,
              variantId: savedVariant.id,
              purchasePrice: v.purchasePrice || 0,
              quantityReceived: qty,
              quantityRemaining: qty,
              referenceType: 'opening_stock',
              referenceId: saved.id,
            });
          }
        }
      }

      await queryRunner.commitTransaction();

      // Auto-link to existing catalog product or create a pending suggestion
      if (!saved.catalogProductId) {
        this.catalogService.autoLinkOrSuggest(
          {
            name:        dto.name,
            description: dto.description,
            image:       dto.image,
            barcode:     dto.variants[0]?.barcode,
            categoryId:  dto.categoryId,
            brandId:     dto.brandId,
            unitId:      dto.unitId,
          },
          userId,
          shopId,
          saved.id,
        ).catch(() => null); // fire-and-forget, don't fail product creation
      }

      return {
        data: await this.findOne(saved.id, shopId),
        message: 'Product created successfully',
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, dto: UpdateProductDto, shopId: string) {
    const product = await this.findOne(id, shopId);

    Object.assign(product, dto);
    await this.productRepository.save(product);

    return {
      data: await this.findOne(id, shopId),
      message: 'Product updated successfully',
    };
  }

  async updatePrice(productId: string, dto: UpdateProductPriceDto, shopId: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(
        ProductPrice,
        { productId, priceType: dto.priceType, isCurrent: true, shopId },
        { isCurrent: false, effectiveTo: new Date() },
      );

      const newPrice = queryRunner.manager.create(ProductPrice, {
        productId,
        priceType: dto.priceType,
        price: dto.price,
        costPrice: dto.costPrice,
        isCurrent: true,
        changedBy: userId,
        reason: dto.reason,
        shopId,
      });
      await queryRunner.manager.save(ProductPrice, newPrice);
      await queryRunner.commitTransaction();

      return {
        data: newPrice,
        message: 'Product price updated successfully',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async syncPricesOnPurchase(
    productId: string,
    shopId: string,
    userId: string,
    unitCost: number,
    sellingPrice?: number,
    wholesalePrice?: number,
  ): Promise<void> {
    const effectiveWholesale = wholesalePrice ?? sellingPrice;
    const candidates: Array<{ priceType: PriceType; newPrice: number }> = [
      { priceType: PriceType.PURCHASE, newPrice: unitCost },
      ...(sellingPrice !== undefined ? [{ priceType: PriceType.RETAIL, newPrice: sellingPrice }] : []),
      ...(effectiveWholesale !== undefined ? [{ priceType: PriceType.WHOLESALE, newPrice: effectiveWholesale }] : []),
    ];

    for (const { priceType, newPrice } of candidates) {
      const current = await this.priceRepository.findOne({ where: { productId, priceType, isCurrent: true, shopId } });
      if (!current || Number(current.price) !== newPrice) {
        await this.priceRepository.update({ productId, priceType, isCurrent: true, shopId }, { isCurrent: false, effectiveTo: new Date() });
        await this.priceRepository.save(
          this.priceRepository.create({ productId, priceType, price: newPrice, isCurrent: true, changedBy: userId, reason: 'Updated via purchase', shopId }),
        );
      }
    }
  }

  async remove(id: string, shopId: string) {
    const product = await this.findOne(id, shopId);
    if (!product) throw new NotFoundException('Product not found');
    await this.productRepository.softDelete(id);
    await this.inventoryRepository.softDelete({ productId: id });
    return { message: 'Product deleted' };
  }

  async restore(id: string, shopId: string) {
    const product = await this.productRepository.findOne({ where: { id, shopId }, withDeleted: true });
    if (!product) throw new NotFoundException('Product not found');
    await this.productRepository.restore(id);
    await this.inventoryRepository.restore({ productId: id });
    return { message: 'Product restored' };
  }

  async getVariantById(variantId: string, shopId: string): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({ where: { id: variantId, shopId } });
    if (!variant) throw new NotFoundException(`Variant not found: ${variantId}`);
    return variant;
  }

  async getDefaultVariantId(productId: string, shopId: string): Promise<string> {
    const variant = await this.variantRepository.findOne({
      where: [
        { productId, isDefault: true },
        { productId },
      ],
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    if (!variant) throw new NotFoundException(`No variant found for product ${productId}`);
    return variant.id;
  }

  async getDefaultVariant(productId: string, shopId: string): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: [
        { productId, isDefault: true },
        { productId },
      ],
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    if (!variant) throw new NotFoundException(`No variant found for product ${productId}`);
    return variant;
  }

  async getAllVariants(filters: import('./dto/product.dto').VariantFilterDto, shopId: string) {
    const { search, productId, categoryId, brandId, status, page = 1, limit = 20 } = filters;

    const qb = this.variantRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.product', 'product')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.unit', 'unit')
      .leftJoinAndSelect('product.prices', 'price', 'price.isCurrent = true')
      .leftJoinAndSelect('v.inventoryItems', 'inv')
      .where('v.shopId = :shopId', { shopId })
      .andWhere('v.deletedAt IS NULL');

    if (search) {
      qb.andWhere(
        '(v.sku ILIKE :search OR v.barcode ILIKE :search OR product.name ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (productId) qb.andWhere('v.productId = :productId', { productId });
    if (categoryId) qb.andWhere('product.categoryId = :categoryId', { categoryId });
    if (brandId) qb.andWhere('product.brandId = :brandId', { brandId });
    if (status) qb.andWhere('v.status = :status', { status });

    const total = await qb.getCount();
    const rawData = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('product.name', 'ASC')
      .addOrderBy('v.isDefault', 'DESC')
      .getMany();

    // Get oldest remaining batch purchase price per variant (FIFO)
    const variantIds = rawData.map((v) => v.id);
    const batchPriceMap: Record<string, number> = {};
    if (variantIds.length > 0) {
      const batches = await this.batchRepository
        .createQueryBuilder('b')
        .select('DISTINCT ON (b.variant_id) b.variant_id', 'variantId')
        .addSelect('b.purchase_price', 'purchasePrice')
        .where('b.variant_id IN (:...variantIds)', { variantIds })
        .andWhere('b.quantity_remaining > 0')
        .orderBy('b.variant_id')
        .addOrderBy('b.created_at', 'ASC')
        .getRawMany();
      for (const row of batches) {
        batchPriceMap[row.variantId] = Number(row.purchasePrice);
      }
    }

    const data = rawData.map((v) => {
      const priceMap = (v.product?.prices ?? []).reduce(
        (acc, pr) => { acc[pr.priceType] = Number(pr.price); return acc; },
        {} as Record<string, number>,
      );
      return {
        id: v.id,
        productId: v.productId,
        productName: v.product?.name ?? null,
        brand: v.product?.brand?.name ?? null,
        category: v.product?.category?.name ?? null,
        unit: v.product?.unit?.symbol ?? null,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        image: this.storage.resolveUrl(v.product?.image),
        status: v.status,
        isDefault: v.isDefault,
        isActive: v.isActive,
        minStockLevel: v.minStockLevel,
        maxStockLevel: v.maxStockLevel,
        reorderPoint: v.reorderPoint,
        trackInventory: v.trackInventory,
        attributes: v.attributes,
        retailPrice: priceMap[PriceType.RETAIL] ?? null,
        purchasePrice: batchPriceMap[v.id] ?? priceMap[PriceType.PURCHASE] ?? null,
        wholesalePrice: priceMap[PriceType.WHOLESALE] ?? null,
        inventory: v.inventoryItems?.[0]
          ? {
              quantityOnHand: v.inventoryItems[0].quantityOnHand,
              quantityAvailable: v.inventoryItems[0].quantityAvailable,
              quantityReserved: v.inventoryItems[0].quantityReserved,
            }
          : null,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      };
    });

    return {
      data,
      message: 'Variants retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getVariants(productId: string, shopId: string) {
    const product = await this.findOne(productId, shopId);
    const variants = await this.variantRepository.find({
      where: { productId: product.id, shopId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    return { data: variants, message: 'Variants retrieved successfully' };
  }

  async createVariant(productId: string, dto: CreateVariantDto, shopId: string) {
    const product = await this.findOne(productId, shopId);
    await this.productRepository.update(product.id, { hasVariants: true });
    const variant = this.variantRepository.create({
      productId: product.id,
      name: dto.name,
      sku: dto.sku,
      barcode: dto.barcode,
      taxRate: dto.taxRate ?? 0,
      status: dto.status ?? ProductStatus.ACTIVE,
      minStockLevel: dto.minStockLevel ?? 0,
      maxStockLevel: dto.maxStockLevel,
      reorderPoint: dto.reorderPoint ?? 0,
      trackInventory: dto.trackInventory ?? true,
      attributes: dto.attributes,
      isDefault: false,
      isActive: true,
      shopId,
    });
    const saved = await this.variantRepository.save(variant);
    await this.inventoryRepository.save({
      shopId,
      productId: product.id,
      variantId: saved.id,
      quantityOnHand: 0,
      quantityAvailable: 0,
      quantityReserved: 0,
    });
    return { data: saved, message: 'Variant created successfully' };
  }

  async getVariant(productId: string, variantId: string, shopId: string) {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId, productId, shopId },
      relations: ['product', 'product.brand', 'product.category', 'product.unit', 'inventoryItems'],
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return { data: variant, message: 'Variant retrieved successfully' };
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateVariantDto, shopId: string) {
    const variant = await this.variantRepository.findOne({ where: { id: variantId, productId, shopId } });
    if (!variant) throw new NotFoundException('Variant not found');
    Object.assign(variant, dto);
    const saved = await this.variantRepository.save(variant);
    return { data: saved, message: 'Variant updated successfully' };
  }

  // --- Bulk Import -----------------------------------------------------------

  /**
   * Generate a pre-formatted Excel template (.xlsx) with two sheets:
   *   - Instructions: field descriptions and allowed values
   *   - Products:     single sheet, rows grouped by "#" column number
   *                   First row of each number = base product
   *                   Subsequent rows with same number = variants of that product
   */

  /**
   * Lookup an entity by name (case-insensitive). If not found, create it under this shop.
   * Returns the UUID, or null if input is blank.
   */
  private async resolveOrCreateCategory(name: string, shopId: string): Promise<string | null> {
    const n = name.trim();
    if (!n) return null;
    const existing = await this.categoryRepo
      .createQueryBuilder('c')
      .where('LOWER(c.name) = LOWER(:n)', { n })
      .andWhere('(c.shopId = :shopId OR c.isGlobal = true)', { shopId })
      .getOne();
    if (existing) return existing.id;
    const created = await this.categoryRepo.save(this.categoryRepo.create({ name: n, shopId, isGlobal: false }));
    return created.id;
  }

  private async resolveOrCreateBrand(name: string, shopId: string): Promise<string | null> {
    const n = name.trim();
    if (!n) return null;
    const existing = await this.brandRepo
      .createQueryBuilder('b')
      .where('LOWER(b.name) = LOWER(:n)', { n })
      .andWhere('(b.shopId = :shopId OR b.isGlobal = true)', { shopId })
      .getOne();
    if (existing) return existing.id;
    const created = await this.brandRepo.save(this.brandRepo.create({ name: n, shopId, isGlobal: false }));
    return created.id;
  }

  private async resolveOrCreateUnit(name: string, shopId: string): Promise<string | null> {
    const n = name.trim();
    if (!n) return null;
    // Match by name OR symbol
    const existing = await this.unitRepo
      .createQueryBuilder('u')
      .where('(LOWER(u.name) = LOWER(:n) OR LOWER(u.symbol) = LOWER(:n))', { n })
      .andWhere('(u.shopId = :shopId OR u.isGlobal = true)', { shopId })
      .getOne();
    if (existing) return existing.id;
    const created = await this.unitRepo.save(this.unitRepo.create({ name: n, symbol: n, shopId, isGlobal: false }));
    return created.id;
  }

  async getImportTemplate(): Promise<Buffer> {
    const wb = XLSX.utils.book_new();

    // Instructions sheet
    const instructions = [
      ['QSell POS - Bulk Product Import Template'],
      [''],
      ['HOW TO USE'],
      ['1. Use the "#" column to group rows. Same number = same product.'],
      ['2. First row of each number = the base product (name, category, brand, unit, price).'],
      ['3. Subsequent rows with the same number = extra variants of that product.'],
      ['4. If a number appears only once = product with a single default variant.'],
      [''],
      ['EXAMPLE'],
      ['# | name              | sku        | barcode    | retailPrice | variantName       | attributes        | initialQty'],
      ['1 | iPhone 15         | IPH15      | 1942534134 | 155000      |                   |                   | 10        '],
      ['1 | iPhone 15         | IPH15-128  | 1942534135 | 150000      | iPhone 15 128GB   | {"storage":"128GB"}| 5        '],
      ['1 | iPhone 15         | IPH15-256  | 1942534136 | 170000      | iPhone 15 256GB   | {"storage":"256GB"}| 3        '],
      ['2 | Samsung Galaxy S24| SGS24      | 8872767299 | 110000      |                   |                   | 8        '],
      [''],
      ['REQUIRED FIELDS'],
      ['# (group number), name, retailPrice'],
      [''],
      ['VARIANT ROWS (same # as base)'],
      ['sku, barcode, retailPrice, variantName, attributes, initialQty — override base values per variant'],
      [''],
      ['ALLOWED VALUES'],
      ['type           : standard | service | digital   (default: standard)'],
      ['status         : active | inactive | discontinued   (default: active)'],
      ['trackInventory : true | false   (default: true)'],
      ['attributes     : valid JSON  e.g.  {"color":"Red","size":"M"}'],
      [''],
      ['NOTES'],
      ['- category / brand / unit : type the NAME (e.g. "Electronics", "Apple", "Piece").'],
      ['  If it already exists it will be reused. If not, it will be created automatically.'],
      ['- Leave optional fields blank to use system defaults.'],
      ['- Invalid rows are skipped and reported in the API response.'],
      ['- Duplicate SKUs or barcodes within the file will be skipped with a warning.'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');

    // Products sheet — single sheet, rows grouped by "#"
    const productHeaders = [
      '#',
      'name',
      'description',
      'type',
      'sku',
      'barcode',
      'retailPrice',
      'purchasePrice',
      'wholesalePrice',
      'variantName',
      'attributes',
      'taxRate',
      'category',
      'brand',
      'unit',
      'status',
      'minStockLevel',
      'maxStockLevel',
      'reorderPoint',
      'trackInventory',
      'initialQuantity',
    ];
    // Row format: #, name, description, type, sku, barcode, retailPrice, purchasePrice, wholesalePrice,
    //             variantName, attributes, taxRate, category, brand, unit,
    //             status, minStockLevel, maxStockLevel, reorderPoint, trackInventory, initialQuantity
    const ex = (...vals: any[]) => vals;
    const rows = [
      productHeaders,
      // Product 1 base (single variant)                                          #  name          desc  type       sku         barcode      retail  purchase  wholesale  variantName  attributes  tax  category     brand   unit   status  min  max  reorder  track  qty
      ex(1, 'Laptop Stand',  '', 'standard', 'LSTND-001',  '8000000001', 1200,  800,    '',  '',                '',                  13,  'Accessories',  '',       'Piece', 'active', 2, 50, 5, true, 10),
      // Product 2 base + 2 variants (iPhone example)
      ex(2, 'iPhone 15',     '', 'standard', 'IPH15',      '1942534134', 155000, 120000, '',  '',                '',                  13,  'Electronics',  'Apple',  'Piece', 'active', 2, 50, 5, true, 0),
      ex(2, 'iPhone 15',     '', '',          'IPH15-128',  '1942534135', 150000, 115000, '',  'iPhone 15 128GB', '{"storage":"128GB"}', '',  '',             '',       '',      'active', 2, 50, 5, true, 5),
      ex(2, 'iPhone 15',     '', '',          'IPH15-256',  '1942534136', 170000, 130000, '',  'iPhone 15 256GB', '{"storage":"256GB"}', '',  '',             '',       '',      'active', 2, 50, 5, true, 3),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Products');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /**
   * Parse an uploaded Excel file (single "Products" sheet, rows grouped by "#" column).
   * Same "#" value = same product. First row = base product, subsequent = variants.
   */
  async bulkImport(fileBuffer: Buffer, shopId: string, userId: string): Promise<BulkImportResult> {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException('Could not parse the uploaded file. Please upload a valid .xlsx file.');
    }

    if (!wb.Sheets['Products']) {
      throw new BadRequestException('The uploaded file must contain a sheet named "Products".');
    }

    const errors: BulkImportResult['errors'] = [];
    let imported = 0;
    let skipped = 0;

    const seenSkus     = new Set<string>();
    const seenBarcodes = new Set<string>();

    const VALID_TYPES    = Object.values(ProductType) as string[];
    const VALID_STATUSES = Object.values(ProductStatus) as string[];

    // Single "Products" sheet — rows with same "#" value belong to the same product
    interface GroupedRow {
      '#'?: string | number;
      name?: string;
      description?: string;
      type?: string;
      sku?: string;
      barcode?: string;
      retailPrice?: string | number;
      purchasePrice?: string | number;
      wholesalePrice?: string | number;
      variantName?: string;
      attributes?: string;
      taxRate?: string | number;
      category?: string;
      brand?: string;
      unit?: string;
      status?: string;
      minStockLevel?: string | number;
      maxStockLevel?: string | number;
      reorderPoint?: string | number;
      trackInventory?: string | boolean;
      initialQuantity?: string | number;
    }

    const allRows = XLSX.utils.sheet_to_json<GroupedRow>(wb.Sheets['Products'], { defval: '', raw: false });

    // Group rows by "#" value, preserving insertion order
    const groups = new Map<string, { rows: GroupedRow[]; startLine: number }>();
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      const key = String(row['#'] ?? '').trim();
      if (!key) {
        errors.push({ sheet: 'Products', row: i + 2, error: '"#" (group number) is required' });
        skipped++;
        continue;
      }
      if (!groups.has(key)) groups.set(key, { rows: [], startLine: i + 2 });
      groups.get(key)!.rows.push(row);
    }

    for (const [groupKey, { rows, startLine }] of groups) {
      const baseRow  = rows[0];
      const rowNum   = startLine;
      const name     = String(baseRow.name ?? '').trim();
      if (!name) {
        errors.push({ sheet: 'Products', row: rowNum, error: 'name is required' });
        skipped++;
        continue;
      }

      const retailPrice = parseFloat(String(baseRow.retailPrice));
      if (isNaN(retailPrice) || retailPrice < 0) {
        errors.push({ sheet: 'Products', row: rowNum, error: 'retailPrice must be a valid non-negative number' });
        skipped++;
        continue;
      }

      const type = String(baseRow.type || 'standard').toLowerCase().trim();
      if (!VALID_TYPES.includes(type)) {
        errors.push({ sheet: 'Products', row: rowNum, error: `type must be one of: ${VALID_TYPES.join(', ')}` });
        skipped++;
        continue;
      }

      const purchasePrice  = baseRow.purchasePrice  ? parseFloat(String(baseRow.purchasePrice))  : null;
      const wholesalePrice = baseRow.wholesalePrice ? parseFloat(String(baseRow.wholesalePrice)) : null;
      const taxRate        = baseRow.taxRate        ? parseFloat(String(baseRow.taxRate))        : 0;
      const description    = String(baseRow.description ?? '').trim() || null;

      // Resolve category / brand / unit by name — create if not found
      const [categoryId, brandId, unitId] = await Promise.all([
        this.resolveOrCreateCategory(String(baseRow.category ?? ''), shopId),
        this.resolveOrCreateBrand(String(baseRow.brand ?? ''), shopId),
        this.resolveOrCreateUnit(String(baseRow.unit ?? ''), shopId),
      ]);

      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        // ── Create base product ───────────────────────────────────────────────
        const product = await qr.manager.save(Product, {
          name, description, type: type as ProductType,
          categoryId, brandId, unitId, shopId,
          hasVariants: rows.length > 1,
        });

        const prices: Partial<ProductPrice>[] = [{
          productId: product.id, priceType: PriceType.RETAIL,
          price: retailPrice, costPrice: purchasePrice ?? undefined,
          isCurrent: true, changedBy: userId, shopId,
        }];
        if (purchasePrice  !== null && !isNaN(purchasePrice)  && purchasePrice  > 0)
          prices.push({ productId: product.id, priceType: PriceType.PURCHASE,   price: purchasePrice,  isCurrent: true, changedBy: userId, shopId });
        if (wholesalePrice !== null && !isNaN(wholesalePrice) && wholesalePrice > 0)
          prices.push({ productId: product.id, priceType: PriceType.WHOLESALE, price: wholesalePrice, isCurrent: true, changedBy: userId, shopId });
        await qr.manager.save(ProductPrice, prices);

        // ── Create variants (first row = default variant) ─────────────────────
        for (let vi = 0; vi < rows.length; vi++) {
          const vRow      = rows[vi];
          const vRowNum   = startLine + vi;
          const isDefault = vi === 0;

          const sku     = String(vRow.sku     ?? '').trim() || null;
          const barcode = String(vRow.barcode ?? '').trim() || null;
          const variantName = String(vRow.variantName ?? '').trim() || name;
          const vStatus = String(vRow.status || 'active').toLowerCase().trim();
          const minStockLevel  = vRow.minStockLevel  ? parseFloat(String(vRow.minStockLevel))  : 0;
          const maxStockLevel  = vRow.maxStockLevel  ? parseFloat(String(vRow.maxStockLevel))  : null;
          const reorderPoint   = vRow.reorderPoint   ? parseFloat(String(vRow.reorderPoint))   : 0;
          const trackInventory = String(vRow.trackInventory).toLowerCase() !== 'false';
          const initialQty     = vRow.initialQuantity ? parseFloat(String(vRow.initialQuantity)) : 0;
          const vRetailPrice   = vRow.retailPrice ? parseFloat(String(vRow.retailPrice)) : retailPrice;

          if (sku && seenSkus.has(sku)) {
            errors.push({ sheet: 'Products', row: vRowNum, error: `Duplicate SKU '${sku}' — skipped this variant` });
            continue;
          }
          if (barcode && seenBarcodes.has(barcode)) {
            errors.push({ sheet: 'Products', row: vRowNum, error: `Duplicate barcode '${barcode}' — skipped this variant` });
            continue;
          }
          if (sku)     seenSkus.add(sku);
          if (barcode) seenBarcodes.add(barcode);

          let attributes: Record<string, string> | undefined;
          const rawAttrs = String(vRow.attributes ?? '').trim();
          if (rawAttrs) {
            try { attributes = JSON.parse(rawAttrs); }
            catch { errors.push({ sheet: 'Products', row: vRowNum, error: 'attributes must be valid JSON e.g. {"color":"Red"}' }); continue; }
          }

          const variant = await qr.manager.save(ProductVariant, {
            productId: product.id, name: variantName,
            sku: sku || null, barcode: barcode || null,
            taxRate: vi === 0 ? taxRate : (vRow.taxRate ? parseFloat(String(vRow.taxRate)) : taxRate),
            status: (VALID_STATUSES.includes(vStatus) ? vStatus : 'active') as ProductStatus,
            minStockLevel, maxStockLevel: maxStockLevel ?? undefined,
            reorderPoint, trackInventory, isDefault, isActive: true,
            attributes, shopId,
          });

          // Per-variant price override
          if (!isDefault && vRetailPrice !== retailPrice) {
            await qr.manager.save(ProductPrice, {
              productId: product.id, priceType: PriceType.RETAIL,
              price: vRetailPrice, isCurrent: false, changedBy: userId, shopId,
            });
          }

          if (type !== ProductType.SERVICE && type !== ProductType.DIGITAL) {
            const invItem = await qr.manager.save(InventoryItem, {
              shopId, productId: product.id, variantId: variant.id,
              quantityOnHand: initialQty, quantityAvailable: initialQty,
              quantityReserved: 0, averageCost: purchasePrice || 0,
              lastRestockedAt: initialQty > 0 ? new Date() : null,
            });

            if (initialQty > 0) {
              await qr.manager.save(InventoryHistory, {
                shopId, inventoryItemId: invItem.id,
                productId: product.id, variantId: variant.id,
                movementType: InventoryMovementType.OPENING_STOCK,
                quantity: initialQty, quantityBefore: 0, quantityAfter: initialQty,
                unitCost: purchasePrice || 0, referenceType: 'opening_stock',
                notes: 'Initial stock from bulk import',
              });
              await qr.manager.save(InventoryBatch, {
                shopId, productId: product.id, variantId: variant.id,
                purchasePrice: purchasePrice || 0,
                quantityReceived: initialQty, quantityRemaining: initialQty,
                referenceType: 'opening_stock', referenceId: product.id,
              });
            }
          }
        }

        await qr.commitTransaction();
        imported++;
      } catch (err: any) {
        await qr.rollbackTransaction();
        errors.push({ sheet: 'Products', row: rowNum, error: err?.detail ?? err?.message ?? 'Unknown error' });
        skipped++;
      } finally {
        await qr.release();
      }
    }

    return { imported, skipped, errors };
  }

}
