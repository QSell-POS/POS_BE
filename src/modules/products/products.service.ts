import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { Product, ProductType } from 'src/modules/products/entities/product.entity';
import { PriceType, ProductPrice } from './entities/product-price.entity';
import { ProductVariant, ProductStatus } from './entities/product-variant.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
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
      const priceMap = (p.prices || []).reduce(
        (acc, pr) => {
          acc[pr.priceType] = Number(pr.price);
          return acc;
        },
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

    const { sku, barcode, image, status, minStockLevel, maxStockLevel, reorderPoint, trackInventory, ...productFields } = dto;
    Object.assign(product, productFields);
    await this.productRepository.save(product);

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

  async createVariant(productId: string, dto: CreateVariantDto, shopId: string) {
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
          taxRate,
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
          name: 'Default',
          sku: sku || null,
          barcode: barcode || null,
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
          await qr.manager.save(InventoryItem, {
            shopId,
            productId: product.id,
            variantId: defaultVariant.id,
            quantityOnHand: initialQuantity,
            quantityAvailable: initialQuantity,
            quantityReserved: 0,
          });
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

          await qr.manager.save(InventoryItem, {
            shopId,
            productId,
            variantId: variant.id,
            quantityOnHand: initialQuantity,
            quantityAvailable: initialQuantity,
            quantityReserved: 0,
          });

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
