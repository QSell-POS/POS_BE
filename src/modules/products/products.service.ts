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
import {
  CreateProductDto,
  CreateVariantDto,
  ProductFilterDto,
  UpdateProductDto,
  UpdateProductPriceDto,
  UpdateVariantDto,
} from './dto/product.dto';
import { BulkImportResult, ProductImportRow, VariantImportRow } from './dto/bulk-import.dto';
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
    @InjectRepository(InventoryBatch)
    private batchRepository: Repository<InventoryBatch>,
    private dataSource: DataSource,
    private readonly storage: StorageService,
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
  ): Promise<void> {
    const updates: Array<{ priceType: PriceType; newPrice: number }> = [];

    const currentPurchase = await this.priceRepository.findOne({ where: { productId, priceType: PriceType.PURCHASE, isCurrent: true, shopId } });
    if (!currentPurchase || Number(currentPurchase.price) !== unitCost) {
      updates.push({ priceType: PriceType.PURCHASE, newPrice: unitCost });
    }

    if (sellingPrice !== undefined) {
      const currentRetail = await this.priceRepository.findOne({ where: { productId, priceType: PriceType.RETAIL, isCurrent: true, shopId } });
      if (!currentRetail || Number(currentRetail.price) !== sellingPrice) {
        updates.push({ priceType: PriceType.RETAIL, newPrice: sellingPrice });
      }
    }

    for (const { priceType, newPrice } of updates) {
      await this.priceRepository.update({ productId, priceType, isCurrent: true, shopId }, { isCurrent: false, effectiveTo: new Date() });
      await this.priceRepository.save(
        this.priceRepository.create({ productId, priceType, price: newPrice, isCurrent: true, changedBy: userId, reason: 'Updated via purchase', shopId }),
      );
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
   * Generate a pre-formatted Excel template (.xlsx) with three sheets:
   *   - Instructions: field descriptions and allowed values
   *   - Products:     one row per product (creates product + default variant)
   *   - Variants:     one row per extra variant linked via productSku
   */
  async getImportTemplate(): Promise<Buffer> {
    const wb = XLSX.utils.book_new();

    // Instructions sheet
    const instructions = [
      ['QSell POS - Bulk Product Import Template'],
      [''],
      ['HOW TO USE'],
      ['1. Fill the "Products" sheet: each row creates one product with its default variant.'],
      ['2. Fill the "Variants" sheet (optional): each row adds an extra variant to a product.'],
      ['   productSku must match the "sku" of a product in the Products sheet.'],
      [''],
      ['REQUIRED FIELDS (must not be left blank)'],
      ['Products sheet : name, retailPrice'],
      ['Variants sheet : productSku, name'],
      [''],
      ['ALLOWED VALUES'],
      ['type           : standard | service | digital   (default: standard)'],
      ['status         : active | inactive | discontinued   (default: active)'],
      ['trackInventory : true | false   (default: true)'],
      ['attributes     : valid JSON string e.g.  {"color":"Red","size":"M"}'],
      [''],
      ['NOTES'],
      ['- categoryId / brandId / unitId must be valid UUIDs already in the system.'],
      ['- Leave optional fields blank to use system defaults.'],
      ['- Invalid rows are skipped and reported in the API response.'],
      ['- Duplicate SKUs or barcodes within the file will be reported as errors.'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');

    // Products sheet
    const productHeaders = [
      'name',
      'description',
      'type',
      'sku',
      'barcode',
      'retailPrice',
      'purchasePrice',
      'wholesalePrice',
      'taxRate',
      'categoryId',
      'brandId',
      'unitId',
      'status',
      'minStockLevel',
      'maxStockLevel',
      'reorderPoint',
      'trackInventory',
      'initialQuantity',
    ];
    const productExample1 = [
      'T-Shirt Blue',
      'A comfortable cotton t-shirt',
      'standard',
      'TSH-BLUE-001',
      '1234567890128',
      500,
      300,
      450,
      13,
      '',
      '',
      '',
      'active',
      5,
      200,
      10,
      true,
      50,
    ];
    const productExample2 = ['Laptop Stand', '', 'standard', 'LSTND-001', '', 1200, 800, '', 13, '', '', '', 'active', 2, 50, 5, true, 10];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([productHeaders, productExample1, productExample2]), 'Products');

    // Variants sheet
    const variantHeaders = [
      'productSku',
      'name',
      'sku',
      'barcode',
      'status',
      'minStockLevel',
      'maxStockLevel',
      'reorderPoint',
      'trackInventory',
      'attributes',
      'initialQuantity',
    ];
    const variantExample1 = [
      'TSH-BLUE-001',
      'T-Shirt Blue - Large',
      'TSH-BLUE-001-L',
      '1234567890135',
      'active',
      5,
      200,
      10,
      true,
      '{"color":"Blue","size":"L"}',
      20,
    ];
    const variantExample2 = [
      'TSH-BLUE-001',
      'T-Shirt Blue - XL',
      'TSH-BLUE-001-XL',
      '1234567890142',
      'active',
      5,
      200,
      10,
      true,
      '{"color":"Blue","size":"XL"}',
      15,
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([variantHeaders, variantExample1, variantExample2]), 'Variants');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /**
   * Parse an uploaded Excel file and bulk-create products + variants.
   * Uses per-row transactions so a bad row never rolls back successful ones.
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

    // Track sku -> productId for variants sheet linkage
    const skuToProductId: Record<string, string> = {};
    // Detect intra-file duplicates before hitting the DB unique index
    const seenSkus = new Set<string>();
    const seenBarcodes = new Set<string>();

    const VALID_TYPES = Object.values(ProductType) as string[];
    const VALID_STATUSES = Object.values(ProductStatus) as string[];

    // Products sheet
    const productRows = XLSX.utils.sheet_to_json<ProductImportRow>(wb.Sheets['Products'], {
      defval: '',
      raw: false,
    });

    for (let i = 0; i < productRows.length; i++) {
      const row = productRows[i];
      const rowNum = i + 2; // row 1 = header
      console.log(row);

      const name = String(row.name ?? '').trim();
      if (!name) {
        errors.push({ sheet: 'Products', row: rowNum, error: 'name is required' });
        skipped++;
        continue;
      }

      const retailPrice = parseFloat(String(row.retailPrice));
      if (isNaN(retailPrice) || retailPrice < 0) {
        errors.push({ sheet: 'Products', row: rowNum, error: 'retailPrice must be a valid non-negative number' });
        skipped++;
        continue;
      }

      const type = String(row.type || 'standard')
        .toLowerCase()
        .trim();
      if (!VALID_TYPES.includes(type)) {
        errors.push({ sheet: 'Products', row: rowNum, error: `type must be one of: ${VALID_TYPES.join(', ')}` });
        skipped++;
        continue;
      }

      const status = String(row.status || 'active')
        .toLowerCase()
        .trim();
      if (!VALID_STATUSES.includes(status)) {
        errors.push({ sheet: 'Products', row: rowNum, error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
        skipped++;
        continue;
      }

      const sku = row.sku ? String(row.sku).trim() : null;
      if (sku) {
        if (seenSkus.has(sku)) {
          errors.push({ sheet: 'Products', row: rowNum, error: `Duplicate SKU '${sku}' within the import file` });
          skipped++;
          continue;
        }
        seenSkus.add(sku);
      }

      const barcode = row.barcode ? String(row.barcode).trim() : null;
      if (barcode) {
        if (seenBarcodes.has(barcode)) {
          errors.push({ sheet: 'Products', row: rowNum, error: `Duplicate barcode '${barcode}' within the import file` });
          skipped++;
          continue;
        }
        seenBarcodes.add(barcode);
      }

      const purchasePrice = row.purchasePrice ? parseFloat(String(row.purchasePrice)) : null;
      const wholesalePrice = row.wholesalePrice ? parseFloat(String(row.wholesalePrice)) : null;
      const taxRate = row.taxRate ? parseFloat(String(row.taxRate)) : 0;
      const minStockLevel = row.minStockLevel ? parseFloat(String(row.minStockLevel)) : 0;
      const maxStockLevel = row.maxStockLevel ? parseFloat(String(row.maxStockLevel)) : null;
      const reorderPoint = row.reorderPoint ? parseFloat(String(row.reorderPoint)) : 0;
      const trackInventory = String(row.trackInventory).toLowerCase() !== 'false';
      const initialQuantity = row.initialQuantity ? parseFloat(String(row.initialQuantity)) : 0;
      const categoryId = row.categoryId ? String(row.categoryId).trim() || null : null;
      const brandId = row.brandId ? String(row.brandId).trim() || null : null;
      const unitId = row.unitId ? String(row.unitId).trim() || null : null;

      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        const product = await qr.manager.save(Product, {
          name,
          description: row.description ? String(row.description).trim() : null,
          type: type as ProductType,
          categoryId,
          brandId,
          unitId,
          shopId,
        });

        const prices: Partial<ProductPrice>[] = [
          {
            productId: product.id,
            priceType: PriceType.RETAIL,
            price: retailPrice,
            costPrice: purchasePrice ?? undefined,
            isCurrent: true,
            changedBy: userId,
            shopId,
          },
        ];
        if (purchasePrice !== null && !isNaN(purchasePrice) && purchasePrice > 0) {
          prices.push({
            productId: product.id,
            priceType: PriceType.PURCHASE,
            price: purchasePrice,
            isCurrent: true,
            changedBy: userId,
            shopId,
          });
        }
        if (wholesalePrice !== null && !isNaN(wholesalePrice) && wholesalePrice > 0) {
          prices.push({
            productId: product.id,
            priceType: PriceType.WHOLESALE,
            price: wholesalePrice,
            isCurrent: true,
            changedBy: userId,
            shopId,
          });
        }
        await qr.manager.save(ProductPrice, prices);

        const defaultVariant = await qr.manager.save(ProductVariant, {
          productId: product.id,
          name,
          sku: sku || null,
          barcode: barcode || null,
          taxRate,
          status: status as ProductStatus,
          minStockLevel,
          maxStockLevel: maxStockLevel ?? undefined,
          reorderPoint,
          trackInventory,
          isDefault: true,
          isActive: true,
          shopId,
        });

        if (type !== ProductType.SERVICE && type !== ProductType.DIGITAL) {
          const inventoryItem = await qr.manager.save(InventoryItem, {
            shopId,
            productId: product.id,
            variantId: defaultVariant.id,
            quantityOnHand: initialQuantity,
            quantityAvailable: initialQuantity,
            quantityReserved: 0,
            averageCost: row.purchasePrice || 0,
            lastRestockedAt: initialQuantity > 0 ? new Date() : null,
          });

          if (initialQuantity > 0) {
            await qr.manager.save(InventoryHistory, {
              shopId,
              inventoryItemId: inventoryItem.id,
              productId: product.id,
              variantId: defaultVariant.id,
              movementType: InventoryMovementType.OPENING_STOCK,
              quantity: initialQuantity,
              quantityBefore: 0,
              quantityAfter: initialQuantity,
              unitCost: row.purchasePrice || 0,
              referenceType: 'opening_stock',
              notes: 'Initial stock from bulk import',
            });

            await qr.manager.save(InventoryBatch, {
              shopId,
              productId: product.id,
              variantId: defaultVariant.id,
              purchasePrice: row.purchasePrice || 0,
              quantityReceived: initialQuantity,
              quantityRemaining: initialQuantity,
              referenceType: 'opening_stock',
              referenceId: product.id,
            });
          }
        }

        await qr.commitTransaction();
        if (sku) skuToProductId[sku] = product.id;
        imported++;
      } catch (err: any) {
        await qr.rollbackTransaction();
        const msg: string = err?.detail ?? err?.message ?? 'Unknown database error';
        errors.push({ sheet: 'Products', row: rowNum, error: msg });
        skipped++;
      } finally {
        await qr.release();
      }
    }

    // Variants sheet (optional)
    if (wb.Sheets['Variants']) {
      const variantRows = XLSX.utils.sheet_to_json<VariantImportRow>(wb.Sheets['Variants'], {
        defval: '',
        raw: false,
      });

      for (let i = 0; i < variantRows.length; i++) {
        const row = variantRows[i];
        const rowNum = i + 2;

        if (!row.productSku && !row.name) continue;

        const productSku = String(row.productSku ?? '').trim();
        if (!productSku) {
          errors.push({ sheet: 'Variants', row: rowNum, error: 'productSku is required' });
          skipped++;
          continue;
        }

        const name = String(row.name ?? '').trim();
        if (!name) {
          errors.push({ sheet: 'Variants', row: rowNum, error: 'name is required' });
          skipped++;
          continue;
        }

        let productId = skuToProductId[productSku];
        if (!productId) {
          const existing = await this.variantRepository.findOne({
            where: { sku: productSku, shopId, isDefault: true },
          });
          if (existing) productId = existing.productId;
        }
        if (!productId) {
          errors.push({ sheet: 'Variants', row: rowNum, error: `No product found with SKU '${productSku}'` });
          skipped++;
          continue;
        }

        let attributes: Record<string, string> | undefined;
        const rawAttrs = String(row.attributes ?? '').trim();
        if (rawAttrs) {
          try {
            attributes = JSON.parse(rawAttrs);
          } catch {
            errors.push({ sheet: 'Variants', row: rowNum, error: 'attributes must be valid JSON e.g. {"color":"Red","size":"M"}' });
            skipped++;
            continue;
          }
        }

        const sku = row.sku ? String(row.sku).trim() : null;
        if (sku) {
          if (seenSkus.has(sku)) {
            errors.push({ sheet: 'Variants', row: rowNum, error: `Duplicate SKU '${sku}' within the import file` });
            skipped++;
            continue;
          }
          seenSkus.add(sku);
        }

        const barcode = row.barcode ? String(row.barcode).trim() : null;
        if (barcode) {
          if (seenBarcodes.has(barcode)) {
            errors.push({ sheet: 'Variants', row: rowNum, error: `Duplicate barcode '${barcode}' within the import file` });
            skipped++;
            continue;
          }
          seenBarcodes.add(barcode);
        }

        const status = String(row.status || 'active')
          .toLowerCase()
          .trim();
        const minStockLevel = row.minStockLevel ? parseFloat(String(row.minStockLevel)) : 0;
        const maxStockLevel = row.maxStockLevel ? parseFloat(String(row.maxStockLevel)) : null;
        const reorderPoint = row.reorderPoint ? parseFloat(String(row.reorderPoint)) : 0;
        const trackInventory = String(row.trackInventory).toLowerCase() !== 'false';
        const initialQuantity = row.initialQuantity ? parseFloat(String(row.initialQuantity)) : 0;

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
          await qr.manager.update(Product, { id: productId, shopId }, { hasVariants: true });

          const variant = await qr.manager.save(ProductVariant, {
            productId,
            name,
            sku: sku || null,
            barcode: barcode || null,
            status: (VALID_STATUSES.includes(status) ? status : 'active') as ProductStatus,
            minStockLevel,
            maxStockLevel: maxStockLevel ?? undefined,
            reorderPoint,
            trackInventory,
            attributes,
            isDefault: false,
            isActive: true,
            shopId,
          });

          const inventoryItem = await qr.manager.save(InventoryItem, {
            shopId,
            productId,
            variantId: variant.id,
            quantityOnHand: initialQuantity,
            quantityAvailable: initialQuantity,
            quantityReserved: 0,
            averageCost: 0,
            lastRestockedAt: initialQuantity > 0 ? new Date() : null,
          });

          if (initialQuantity > 0) {
            await qr.manager.save(InventoryHistory, {
              shopId,
              inventoryItemId: inventoryItem.id,
              productId,
              variantId: variant.id,
              movementType: InventoryMovementType.OPENING_STOCK,
              quantity: initialQuantity,
              quantityBefore: 0,
              quantityAfter: initialQuantity,
              unitCost: 0,
              referenceType: 'opening_stock',
              notes: 'Initial stock from variant bulk import',
            });

            await qr.manager.save(InventoryBatch, {
              shopId,
              productId,
              variantId: variant.id,
              purchasePrice: 0,
              quantityReceived: initialQuantity,
              quantityRemaining: initialQuantity,
              referenceType: 'opening_stock',
              referenceId: productId,
            });
          }

          await qr.commitTransaction();
          imported++;
        } catch (err: any) {
          await qr.rollbackTransaction();
          const msg: string = err?.detail ?? err?.message ?? 'Unknown database error';
          errors.push({ sheet: 'Variants', row: rowNum, error: msg });
          skipped++;
        } finally {
          await qr.release();
        }
      }
    }

    return { imported, skipped, errors };
  }
}
