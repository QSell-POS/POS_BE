import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

import { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { ProductsService } from '../products/products.service';
import { InventoryService } from '../inventory/inventory.service';
import { PurchaseReturn, PurchaseReturnItem, PurchaseReturnStatus } from './entities/purchase-return.entity';
import {
  CreatePurchaseDto,
  CreatePurchaseReturnDto,
  CreateSupplierDto,
  PurchaseFilterDto,
  PurchaseReturnFilterDto,
  ReceivePurchaseDto,
  SupplierFilterDto,
  UpdateSupplierDto,
} from './dto/purchase.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { PaymentStatus, Purchase, PurchaseStatus } from './entities/purchase.entity';
import { ExpensesService } from '../expenses/expenses.service';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(PurchaseItem)
    private purchaseItemRepository: Repository<PurchaseItem>,
    @InjectRepository(PurchaseReturn)
    private returnRepository: Repository<PurchaseReturn>,
    @InjectRepository(PurchaseReturnItem)
    private returnItemRepository: Repository<PurchaseReturnItem>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    private inventoryService: InventoryService,
    private productsService: ProductsService,
    private expensesService: ExpensesService,
    private dataSource: DataSource,
  ) {}

  // ── Suppliers ─────────────────────────────────────────────
  async createSupplier(dto: CreateSupplierDto, shopId: string) {
    const supplier = this.supplierRepository.create({ ...dto, shopId });
    return this.supplierRepository.save(supplier);
  }

  async getSuppliers(shopId: string, filters: SupplierFilterDto) {
    const { search, page = 1, limit = 20 } = filters;
    const qb = this.supplierRepository.createQueryBuilder('s').where('s.shopId = :shopId', { shopId });
    if (search) qb.andWhere('(s.name ILIKE :search OR s.contactPerson ILIKE :search OR s.phone ILIKE :search)', { search: `%${search}%` });

    const total = await qb.getCount();
    const data = await qb
      .orderBy('s.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Suppliers fetched successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto, shopId: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id, shopId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    Object.assign(supplier, dto);
    return this.supplierRepository.save(supplier);
  }

  // ── Purchases ─────────────────────────────────────────────
  async create(dto: CreatePurchaseDto, shopId: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Calculate totals
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

      const refNum = await this.generateReferenceNumber('PO', shopId);

      const purchase = queryRunner.manager.create(Purchase, {
        referenceNumber: refNum,
        supplierId: dto.supplierId,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        subtotal,
        taxAmount,
        shippingCost,
        discountAmount,
        grandTotal,
        dueAmount: grandTotal,
        paidAmount: 0,
        status: PurchaseStatus.ORDERED,
        paymentStatus: PaymentStatus.PENDING,
        createdBy: userId,
        notes: dto.notes,
        attachment: dto.attachment,
        shopId,
      });

      const saved = await queryRunner.manager.save(Purchase, purchase);

      const items = itemsWithTotals.map((item) =>
        queryRunner.manager.create(PurchaseItem, {
          purchaseId: saved.id,
          productId: item.productId,
          quantity: item.quantity,
          receivedQuantity: 0,
          unitCost: item.unitCost,
          taxRate: item.taxRate || 0,
          taxAmount: item.taxAmount,
          discountRate: item.discountRate || 0,
          discountAmount: item.discountAmount,
          subtotal: item.subtotal,
          notes: item.notes,
          shopId,
        }),
      );

      await queryRunner.manager.save(PurchaseItem, items);
      await queryRunner.commitTransaction();

      return this.findOne(saved.id, shopId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.createdAt', 'DESC')
      .getMany();

    return {
      data,
      message: 'Purchases fetched successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, shopId: string) {
    const purchase = await this.purchaseRepository.findOne({
      where: { id, shopId },
      relations: ['supplier', 'items', 'items.product'],
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  async receivePurchase(id: string, dto: ReceivePurchaseDto, shopId: string, userId: string) {
    const purchase = await this.findOne(id, shopId);
    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new BadRequestException('Cannot receive a cancelled purchase');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const received of dto.receivedItems) {
        const item = purchase.items.find((i) => i.id === received.purchaseItemId);
        if (!item) continue;

        const newReceived = Number(item.receivedQuantity) + received.receivedQuantity;
        if (newReceived > Number(item.quantity)) {
          throw new BadRequestException(`Cannot receive more than ordered for product ${item.productId}`);
        }

        await queryRunner.manager.update(PurchaseItem, item.id, {
          receivedQuantity: newReceived,
        });

        // Update inventory
        await this.inventoryService.adjustStock(
          {
            productId: item.productId,
            quantity: received.receivedQuantity,
            movementType: InventoryMovementType.PURCHASE,
            unitCost: Number(item.unitCost),
            referenceId: purchase.id,
            referenceType: 'purchase',
            notes: dto.notes,
            performedBy: userId,
          },
          shopId,
        );
      }

      // Update purchase status
      const updatedItems = await queryRunner.manager.find(PurchaseItem, {
        where: { purchaseId: id },
      });
      const allReceived = updatedItems.every((i) => Number(i.receivedQuantity) >= Number(i.quantity));
      const anyReceived = updatedItems.some((i) => Number(i.receivedQuantity) > 0);

      await queryRunner.manager.update(Purchase, id, {
        status: allReceived ? PurchaseStatus.RECEIVED : anyReceived ? PurchaseStatus.PARTIAL : purchase.status,
      });

      // Record expense
      await this.expensesService.recordSystemExpense(
        {
          typeName: 'Purchase',
          title: `Purchase received: ${purchase.referenceNumber}`,
          amount: purchase.grandTotal,
          referenceId: purchase.id,
          referenceType: 'purchase',
        },
        shopId,
        userId,
      );

      await queryRunner.commitTransaction();
      return this.findOne(id, shopId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async recordPayment(id: string, amount: number, shopId: string) {
    const purchase = await this.findOne(id, shopId);
    const newPaid = Number(purchase.paidAmount) + amount;
    if (newPaid > Number(purchase.grandTotal)) {
      throw new BadRequestException('Payment exceeds total amount');
    }
    const dueAmount = Number(purchase.grandTotal) - newPaid;
    await this.purchaseRepository.update(id, {
      paidAmount: newPaid,
      dueAmount,
      paymentStatus: dueAmount === 0 ? PaymentStatus.PAID : newPaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING,
    });
    return this.findOne(id, shopId);
  }

  // ── Purchase Returns ───────────────────────────────────────
  async createReturn(dto: CreatePurchaseReturnDto, shopId: string, userId: string) {
    const purchase = await this.findOne(dto.purchaseId, shopId);

    const totalAmount = dto.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

    const refNum = await this.generateReferenceNumber('PRN', shopId);
    const ret = this.returnRepository.create({
      referenceNumber: refNum,
      purchaseId: dto.purchaseId,
      supplierId: purchase.supplierId,
      status: PurchaseReturnStatus.CONFIRMED,
      totalAmount,
      reason: dto.reason,
      notes: dto.notes,
      createdBy: userId,
      shopId,
    });
    const savedReturn = await this.returnRepository.save(ret);

    const items = dto.items.map((item) =>
      this.returnItemRepository.create({
        purchaseReturnId: savedReturn.id,
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        subtotal: item.quantity * item.unitCost,
        reason: item.reason,
        shopId,
      }),
    );
    await this.returnItemRepository.save(items);

    // Deduct from inventory
    for (const item of dto.items) {
      await this.inventoryService.adjustStock(
        {
          productId: item.productId,
          quantity: item.quantity,
          movementType: InventoryMovementType.RETURN_OUT,
          unitCost: item.unitCost,
          referenceId: savedReturn.id,
          referenceType: 'purchase_return',
          performedBy: userId,
        },
        shopId,
      );
    }

    return savedReturn;
  }

  async getReturns(shopId: string, filters: PurchaseReturnFilterDto) {
    const { page = 1, limit = 20 } = filters;
    const [data, total] = await this.returnRepository.findAndCount({
      where: { shopId },
      relations: ['supplier', 'purchase'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      message: 'Purchase returns fetched successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  private async generateReferenceNumber(prefix: string, shopId: string): Promise<string> {
    const date = new Date();
    const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.purchaseRepository.count({ where: { shopId } });
    return `${prefix}-${yyyymm}-${String(count + 1).padStart(4, '0')}`;
  }
}
