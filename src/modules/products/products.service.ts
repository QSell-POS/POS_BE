import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { Product } from 'src/modules/products/entities/product.entity';
import { PriceType, ProductPrice } from './entities/product-price.entity';
import { ProductVariant, ProductStatus } from './entities/product-variant.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { CreateProductDto, ProductFilterDto, UpdateProductDto, UpdateProductPriceDto } from './dto/product.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

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
    private dataSource: DataSource,
  ) {}

  async findAll(filters: ProductFilterDto, shopId: string) {
    const { search, categoryId, brandId, status, lowStock, page = 1, limit = 20 } = filters;

    const qb = this.productRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.unit', 'unit')
      .leftJoinAndSelect('p.prices', 'price', 'price.isCurrent = true')
      .leftJoinAndSelect('p.variants', 'variant', 'variant.isDefault = true')
      .leftJoinAndSelect('p.inventoryItems', 'inv', 'inv.variantId = variant.id')
      .where('p.shopId = :shopId', { shopId })
      .andWhere('p.deletedAt IS NULL');

    if (search) {
      qb.andWhere(
        '(p.name ILIKE :search OR variant.sku ILIKE :search OR variant.barcode ILIKE :search)',
        { search: `%${search}%` },
      );
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
      const priceMap = (p.prices || []).reduce(
        (acc, pr) => { acc[pr.priceType] = Number(pr.price); return acc; },
        {} as Record<string, number>,
      );
      const defaultVariant = p.variants?.[0];
      const inventory = p.inventoryItems?.[0];
      return {
        id: p.id,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        shopId: p.shopId,
        name: p.name,
        description: p.description,
        type: p.type,
        brandId: p.brandId,
        categoryId: p.categoryId,
        unitId: p.unitId,
        taxRate: p.taxRate,
        hasVariants: p.hasVariants,
        brand: p.brand?.name,
        category: p.category?.name,
        unit: p.unit?.symbol,
        // default variant fields (flat)
        variantId: defaultVariant?.id ?? null,
        sku: defaultVariant?.sku ?? null,
        barcode: defaultVariant?.barcode ?? null,
        image: defaultVariant?.image ?? null,
        status: defaultVariant?.status ?? null,
        minStockLevel: defaultVariant?.minStockLevel ?? null,
        maxStockLevel: defaultVariant?.maxStockLevel ?? null,
        reorderPoint: defaultVariant?.reorderPoint ?? null,
        trackInventory: defaultVariant?.trackInventory ?? true,
        purchasePrice: priceMap[PriceType.PURCHASE] ?? null,
        retailPrice: priceMap[PriceType.RETAIL] ?? null,
        wholesalePrice: priceMap[PriceType.WHOLESALE] ?? null,
        inventory: inventory
          ? {
              quantityOnHand: inventory.quantityOnHand,
              quantityReserved: inventory.quantityReserved,
              quantityAvailable: inventory.quantityAvailable,
            }
          : null,
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
      .leftJoinAndSelect('p.unit', 'unit')
      .leftJoinAndSelect('p.prices', 'price', 'price.isCurrent = true AND price.priceType = :retailType', { retailType: PriceType.RETAIL })
      .where('v.barcode = :barcode AND v.shopId = :shopId', { barcode, shopId })
      .getOne();

    if (!variant) throw new NotFoundException('Product not found');
    return variant;
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

  async create(dto: CreateProductDto, shopId: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = queryRunner.manager.create(Product, {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        unitId: dto.unitId,
        taxRate: dto.taxRate,
        shopId,
      });
      const saved = await queryRunner.manager.save(Product, product);

      // Create retail price
      const prices: Partial<ProductPrice>[] = [];
      prices.push({
        productId: saved.id,
        priceType: PriceType.RETAIL,
        price: dto.retailPrice,
        costPrice: dto.purchasePrice,
        isCurrent: true,
        changedBy: userId,
        shopId,
      });

      if (dto.purchasePrice) {
        prices.push({
          productId: saved.id,
          priceType: PriceType.PURCHASE,
          price: dto.purchasePrice,
          isCurrent: true,
          changedBy: userId,
          shopId,
        });
      }

      if (dto.wholesalePrice) {
        prices.push({
          productId: saved.id,
          priceType: PriceType.WHOLESALE,
          price: dto.wholesalePrice,
          isCurrent: true,
          changedBy: userId,
          shopId,
        });
      }

      await queryRunner.manager.save(ProductPrice, prices);

      // Create default variant with variant-level fields
      const defaultVariant = await queryRunner.manager.save(ProductVariant, {
        productId: saved.id,
        name: 'Default',
        sku: dto.sku,
        barcode: dto.barcode,
        image: dto.image,
        status: dto.status ?? ProductStatus.ACTIVE,
        minStockLevel: dto.minStockLevel ?? 0,
        maxStockLevel: dto.maxStockLevel,
        reorderPoint: dto.reorderPoint ?? 0,
        trackInventory: dto.trackInventory ?? true,
        isDefault: true,
        isActive: true,
        shopId,
      });

      // Create inventory item scoped to the default variant
      if (dto.type !== 'service' && dto.type !== 'digital') {
        await queryRunner.manager.save(InventoryItem, {
          shopId,
          productId: saved.id,
          variantId: defaultVariant.id,
          quantityOnHand: dto.initialQuantity || 0,
          quantityAvailable: dto.initialQuantity || 0,
          quantityReserved: 0,
        });
      }

      await queryRunner.commitTransaction();
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

    // Separate product-level fields from variant-level fields
    const { sku, barcode, image, status, minStockLevel, maxStockLevel, reorderPoint, trackInventory, ...productFields } = dto;
    Object.assign(product, productFields);
    await this.productRepository.save(product);

    // Update default variant if any variant-level fields are provided
    const variantUpdate: Partial<ProductVariant> = {};
    if (sku !== undefined) variantUpdate.sku = sku;
    if (barcode !== undefined) variantUpdate.barcode = barcode;
    if (image !== undefined) variantUpdate.image = image;
    if (status !== undefined) variantUpdate.status = status;
    if (minStockLevel !== undefined) variantUpdate.minStockLevel = minStockLevel;
    if (maxStockLevel !== undefined) variantUpdate.maxStockLevel = maxStockLevel;
    if (reorderPoint !== undefined) variantUpdate.reorderPoint = reorderPoint;
    if (trackInventory !== undefined) variantUpdate.trackInventory = trackInventory;

    if (Object.keys(variantUpdate).length > 0) {
      await this.variantRepository.update({ productId: id, isDefault: true, shopId }, variantUpdate);
    }

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

  async getDefaultVariantId(productId: string, shopId: string): Promise<string> {
    const variant = await this.variantRepository.findOne({
      where: { productId, shopId, isDefault: true },
    });
    if (!variant) throw new NotFoundException(`No default variant found for product ${productId}`);
    return variant.id;
  }

  async getDefaultVariant(productId: string, shopId: string): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: { productId, shopId, isDefault: true },
    });
    if (!variant) throw new NotFoundException(`No default variant found for product ${productId}`);
    return variant;
  }

  async getVariants(productId: string, shopId: string) {
    const product = await this.findOne(productId, shopId);
    const variants = await this.variantRepository.find({
      where: { productId: product.id, shopId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    return { data: variants, message: 'Variants retrieved successfully' };
  }

  async createVariant(productId: string, dto: { name: string; sku?: string; barcode?: string; image?: string; status?: ProductStatus; minStockLevel?: number; maxStockLevel?: number; reorderPoint?: number; trackInventory?: boolean; attributes?: Record<string, string> }, shopId: string) {
    const product = await this.findOne(productId, shopId);
    await this.productRepository.update(product.id, { hasVariants: true });
    const variant = this.variantRepository.create({
      productId: product.id,
      name: dto.name,
      sku: dto.sku,
      barcode: dto.barcode,
      image: dto.image,
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

  async updateVariant(productId: string, variantId: string, dto: Partial<{ name: string; sku: string; barcode: string; image: string; status: ProductStatus; minStockLevel: number; maxStockLevel: number; reorderPoint: number; trackInventory: boolean; attributes: Record<string, string>; isActive: boolean }>, shopId: string) {
    const variant = await this.variantRepository.findOne({ where: { id: variantId, productId, shopId } });
    if (!variant) throw new NotFoundException('Variant not found');
    Object.assign(variant, dto);
    const saved = await this.variantRepository.save(variant);
    return { data: saved, message: 'Variant updated successfully' };
  }
}
