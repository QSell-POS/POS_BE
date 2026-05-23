import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { StorageService } from 'src/common/services/storage.service';
import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductsService } from '../products/products.service';
import { InventoryService } from '../inventory/inventory.service';
import { SupplierLedgerType } from './entities/supplier-ledger.entity';
import { CreatePurchaseDto, PurchaseFilterDto, ReceivePurchaseDto } from './dto/purchase.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { Purchase, PurchaseStatus } from './entities/purchase.entity';
import { SuppliersService } from '../suppliers/suppliers.service';
import { ReferenceNumberService } from 'src/common/services/reference-number.service';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)     private purchaseRepository: Repository<Purchase>,
    @InjectRepository(PurchaseItem) private purchaseItemRepository: Repository<PurchaseItem>,
    private readonly suppliersService: SuppliersService,
    private readonly inventoryService: InventoryService,
    private readonly productsService: ProductsService,
    private readonly referenceNumberService: ReferenceNumberService,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
  ) {}

  async create(dto: CreatePurchaseDto, shopId: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      let subtotal = 0;
      const itemsWithTotals = dto.items.map((item) => {
        const taxAmount = (item.unitCost * item.quantity * (item.taxRate || 0)) / 100;
        const discountAmount = (item.unitCost * item.quantity * (item.discountRate || 0)) / 100;
        const itemSubtotal = item.unitCost * item.quantity + taxAmount - discountAmount;
        subtotal += itemSubtotal;
        return { ...item, taxAmount, discountAmount, subtotal: itemSubtotal };
      });

      const taxAmount = itemsWithTotals.reduce((s, i) => s + i.taxAmount, 0);
      const shippingCost = dto.shippingCost || 0;
      const discountAmount = dto.discountAmount || 0;
      const grandTotal = subtotal + shippingCost - discountAmount;
      const creditAmount = dto.creditAmount || 0;
      const isReceived = dto.isReceived !== false;

      if (creditAmount > grandTotal) throw new BadRequestException('Credit amount cannot exceed grand total');
      if (creditAmount > 0 && !dto.supplierId) throw new BadRequestException('A supplier must be selected for credit purchases');

      const refNum = await this.referenceNumberService.generate('PO', shopId, { table: 'purchases', padWidth: 4 });

      const purchase = queryRunner.manager.create(Purchase, {
        referenceNumber: refNum,
        supplierId: dto.supplierId,
        isReceived,
        subtotal,
        taxAmount,
        shippingCost,
        discountAmount,
        grandTotal,
        creditAmount,
        status: PurchaseStatus.COMPLETED,
        supplierBillNumber: dto.supplierBillNumber,
        createdBy: userId,
        notes: dto.notes,
        attachment: dto.attachment,
        shopId,
      });

      const saved = await queryRunner.manager.save(Purchase, purchase);

      const itemsWithVariants = await Promise.all(
        itemsWithTotals.map(async (item) => {
          const variant = await this.productsService.getVariantById(item.variantId, shopId);
          return { ...item, productId: variant.productId, variantId: variant.id };
        }),
      );

      await queryRunner.manager.save(
        PurchaseItem,
        itemsWithVariants.map((item) =>
          queryRunner.manager.create(PurchaseItem, {
            purchaseId: saved.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            receivedQuantity: isReceived ? item.quantity : 0,
            unitCost: item.unitCost,
            sellingPrice: item.sellingPrice ?? null,
            wholesalePrice: item.wholesalePrice ?? null,
            taxRate: item.taxRate || 0,
            taxAmount: item.taxAmount,
            discountRate: item.discountRate || 0,
            discountAmount: item.discountAmount,
            subtotal: item.subtotal,
            notes: item.notes,
            shopId,
          }),
        ),
      );

      await queryRunner.commitTransaction();

      if (isReceived) {
        for (const item of itemsWithVariants) {
          await this.inventoryService.adjustStock(
            { productId: item.productId, variantId: item.variantId, quantity: item.quantity, movementType: InventoryMovementType.PURCHASE, unitCost: item.unitCost, retailPrice: item.sellingPrice, wholesalePrice: item.wholesalePrice, referenceId: refNum, referenceType: 'purchase', performedBy: userId },
            shopId,
          );
          await this.productsService.syncPricesOnPurchase(item.productId, shopId, userId, item.unitCost, item.sellingPrice, item.wholesalePrice);
        }
      }

      if (creditAmount > 0 && dto.supplierId) {
        await this.suppliersService.recordDebit(dto.supplierId, shopId, creditAmount, {
          type: SupplierLedgerType.PURCHASE_DEBIT,
          referenceType: 'purchase',
          referenceId: saved.id,
          description: `Credit purchase: ${refNum}`,
          createdBy: userId,
        });
      }

      if (dto.supplierId) {
        await this.suppliersService.incrementTotalPurchased(dto.supplierId, grandTotal);
      }

      return this.findOne(saved.id, shopId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async receivePurchase(id: string, dto: ReceivePurchaseDto, shopId: string, userId: string) {
    const purchase = await this.findOne(id, shopId);
    if (purchase.isReceived) throw new BadRequestException('Purchase has already been received');
    if (purchase.status === PurchaseStatus.CANCELLED) throw new BadRequestException('Cannot receive a cancelled purchase');

    for (const item of purchase.items) {
      await this.inventoryService.adjustStock(
        { productId: item.productId, variantId: item.variantId, quantity: Number(item.quantity), movementType: InventoryMovementType.PURCHASE, unitCost: Number(item.unitCost), retailPrice: item.sellingPrice ? Number(item.sellingPrice) : undefined, wholesalePrice: item.wholesalePrice ? Number(item.wholesalePrice) : undefined, referenceId: dto.supplierBillNumber || purchase.referenceNumber, referenceType: 'purchase', notes: dto.notes, performedBy: userId },
        shopId,
      );
      await this.productsService.syncPricesOnPurchase(item.productId, shopId, userId, Number(item.unitCost), item.sellingPrice ? Number(item.sellingPrice) : undefined, item.wholesalePrice ? Number(item.wholesalePrice) : undefined);
    }

    await this.purchaseRepository.update(id, {
      isReceived: true,
      ...(dto.supplierBillNumber ? { supplierBillNumber: dto.supplierBillNumber } : {}),
    });

    return this.findOne(id, shopId);
  }

  async findAll(shopId: string, filters: PurchaseFilterDto) {
    const { search, status, supplierId, startDate, endDate, page = 1, limit = 20 } = filters;
    const qb = this.purchaseRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.supplier', 'supplier')
      .where('p.shopId = :shopId', { shopId });

    if (search) qb.andWhere('p.referenceNumber ILIKE :search', { search: `%${search}%` });
    if (status) qb.andWhere('p.status = :status', { status });
    if (supplierId) qb.andWhere('p.supplierId = :supplierId', { supplierId });
    if (startDate) qb.andWhere('p.purchaseDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('p.purchaseDate <= :endDate', { endDate });

    const total = await qb.getCount();
    const data = await qb.skip((page - 1) * limit).take(limit).orderBy('p.createdAt', 'DESC').getMany();
    return { data, message: 'Purchases fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, shopId: string) {
    const purchase = await this.purchaseRepository.findOne({
      where: { id, shopId },
      relations: ['supplier', 'items', 'items.product', 'items.product.brand', 'items.product.category', 'items.product.unit', 'items.variant'],
    });
    if (!purchase) throw new NotFoundException('Purchase not found');

    return {
      ...purchase,
      items: purchase.items.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        shopId: item.shopId,
        purchaseId: item.purchaseId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        receivedQuantity: item.receivedQuantity,
        unitCost: item.unitCost,
        sellingPrice: item.sellingPrice,
        wholesalePrice: item.wholesalePrice,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        discountRate: item.discountRate,
        discountAmount: item.discountAmount,
        subtotal: item.subtotal,
        notes: item.notes,
        product: item.product ? {
          name: item.product.name,
          description: item.product.description,
          image: this.storage.resolveUrl(item.product.image),
          type: item.product.type,
          brand: item.product.brand?.name ?? null,
          category: item.product.category?.name ?? null,
          unit: item.product.unit?.symbol ?? null,
        } : null,
        variant: item.variant ? {
          name: item.variant.name,
          sku: item.variant.sku,
          barcode: item.variant.barcode,
          attributes: item.variant.attributes,
        } : null,
      })),
    };
  }
}
