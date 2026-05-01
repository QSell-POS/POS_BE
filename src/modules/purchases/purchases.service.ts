import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { ProductsService } from '../products/products.service';
import { InventoryService } from '../inventory/inventory.service';
import { PurchaseReturn, PurchaseReturnItem, PurchaseReturnStatus } from './entities/purchase-return.entity';
import { SupplierLedger, SupplierLedgerType } from './entities/supplier-ledger.entity';
import { SupplierPayment } from './entities/supplier-payment.entity';
import {
  CreatePurchaseDto,
  CreatePurchaseReturnDto,
  CreateSupplierDto,
  CreateSupplierPaymentDto,
  PurchaseFilterDto,
  PurchaseReturnFilterDto,
  ReceivePurchaseDto,
  SupplierFilterDto,
  UpdateSupplierDto,
} from './dto/purchase.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { Purchase, PurchaseStatus } from './entities/purchase.entity';
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
    @InjectRepository(SupplierLedger)
    private ledgerRepository: Repository<SupplierLedger>,
    @InjectRepository(SupplierPayment)
    private supplierPaymentRepository: Repository<SupplierPayment>,
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
    return { data, message: 'Suppliers fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async getSupplierById(id: string, shopId: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id, shopId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto, shopId: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id, shopId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    Object.assign(supplier, dto);
    return this.supplierRepository.save(supplier);
  }

  // ── Supplier Ledger ────────────────────────────────────────
  async getSupplierLedger(supplierId: string, shopId: string, page = 1, limit = 20) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId, shopId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const [data, total] = await this.ledgerRepository.findAndCount({
      where: { supplierId, shopId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, message: 'Supplier ledger fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async getSupplierStatement(supplierId: string, shopId: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId, shopId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const ledger = await this.ledgerRepository.find({
      where: { supplierId, shopId },
      order: { createdAt: 'ASC' },
    });
    const balance = ledger.length > 0 ? Number(ledger[ledger.length - 1].balanceAfter) : 0;
    return { data: { supplier, balance, transactions: ledger } };
  }

  async recordSupplierPayment(dto: CreateSupplierPaymentDto, shopId: string, userId: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id: dto.supplierId, shopId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const balance = await this.getSupplierBalance(dto.supplierId, shopId);
    if (dto.amount > balance) {
      throw new BadRequestException(`Payment (${dto.amount}) exceeds outstanding balance (${balance})`);
    }

    const balanceAfter = balance - dto.amount;

    const payment = await this.supplierPaymentRepository.save(
      this.supplierPaymentRepository.create({
        supplierId: dto.supplierId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod ?? 'cash',
        notes: dto.notes,
        createdBy: userId,
        shopId,
      }),
    );

    await this.ledgerRepository.save(
      this.ledgerRepository.create({
        supplierId: dto.supplierId,
        type: SupplierLedgerType.PAYMENT_SENT,
        amount: dto.amount,
        balanceAfter,
        referenceType: 'supplier_payment',
        referenceId: payment.id,
        description: `Payment to supplier: ${supplier.name}`,
        createdBy: userId,
        shopId,
      }),
    );

    await this.supplierRepository.update(dto.supplierId, { totalDue: balanceAfter });

    await this.expensesService.recordSystemExpense(
      {
        typeName: 'Supplier Payment',
        title: `Supplier payment: ${supplier.name}`,
        amount: dto.amount,
        referenceId: payment.id,
        referenceType: 'supplier_payment',
      },
      shopId,
      userId,
    );

    return { data: payment, message: 'Supplier payment recorded successfully' };
  }

  private async getSupplierBalance(supplierId: string, shopId: string): Promise<number> {
    const last = await this.ledgerRepository.findOne({
      where: { supplierId, shopId },
      order: { createdAt: 'DESC' },
    });
    return last ? Number(last.balanceAfter) : 0;
  }

  // ── Purchases ─────────────────────────────────────────────
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
      const isReceived = dto.isReceived !== false; // default true

      if (creditAmount > grandTotal) {
        throw new BadRequestException('Credit amount cannot exceed grand total');
      }
      if (creditAmount > 0 && !dto.supplierId) {
        throw new BadRequestException('A supplier must be selected for credit purchases');
      }

      const refNum = await this.generateReferenceNumber('PO', shopId);

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

      const items = itemsWithTotals.map((item) =>
        queryRunner.manager.create(PurchaseItem, {
          purchaseId: saved.id,
          productId: item.productId,
          quantity: item.quantity,
          receivedQuantity: isReceived ? item.quantity : 0,
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

      // Adjust inventory and record expense if received
      if (isReceived) {
        for (const item of itemsWithTotals) {
          await this.inventoryService.adjustStock(
            {
              productId: item.productId,
              quantity: item.quantity,
              movementType: InventoryMovementType.PURCHASE,
              unitCost: item.unitCost,
              referenceId: refNum,
              referenceType: 'purchase',
              performedBy: userId,
            },
            shopId,
          );
        }

        await this.expensesService.recordSystemExpense(
          {
            typeName: 'Purchase',
            title: `Purchase: ${refNum}`,
            amount: grandTotal,
            referenceId: saved.id,
            referenceType: 'purchase',
          },
          shopId,
          userId,
        );
      }

      // Supplier ledger for credit portion
      if (creditAmount > 0 && dto.supplierId) {
        const prevBalance = await this.getSupplierBalance(dto.supplierId, shopId);
        const balanceAfter = prevBalance + creditAmount;
        await this.ledgerRepository.save(
          this.ledgerRepository.create({
            supplierId: dto.supplierId,
            type: SupplierLedgerType.PURCHASE_DEBIT,
            amount: creditAmount,
            balanceAfter,
            referenceType: 'purchase',
            referenceId: saved.id,
            description: `Credit purchase: ${refNum}`,
            createdBy: userId,
            shopId,
          }),
        );
        await this.supplierRepository.increment({ id: dto.supplierId }, 'totalDue', creditAmount);
      }

      if (dto.supplierId) {
        await this.supplierRepository.increment({ id: dto.supplierId }, 'totalPurchased', grandTotal);
      }
      await queryRunner.commitTransaction();
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
    if (purchase.isReceived) {
      throw new BadRequestException('Purchase has already been received');
    }
    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new BadRequestException('Cannot receive a cancelled purchase');
    }

    for (const item of purchase.items) {
      await this.inventoryService.adjustStock(
        {
          productId: item.productId,
          quantity: Number(item.quantity),
          movementType: InventoryMovementType.PURCHASE,
          unitCost: Number(item.unitCost),
          referenceId: dto.supplierBillNumber || purchase.referenceNumber,
          referenceType: 'purchase',
          notes: dto.notes,
          performedBy: userId,
        },
        shopId,
      );
    }

    await this.purchaseRepository.update(id, {
      isReceived: true,
      ...(dto.supplierBillNumber ? { supplierBillNumber: dto.supplierBillNumber } : {}),
    });

    await this.expensesService.recordSystemExpense(
      {
        typeName: 'Purchase',
        title: `Purchase received: ${purchase.referenceNumber}`,
        amount: Number(purchase.grandTotal),
        referenceId: purchase.id,
        referenceType: 'purchase',
      },
      shopId,
      userId,
    );

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
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.createdAt', 'DESC')
      .getMany();

    return { data, message: 'Purchases fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, shopId: string) {
    const purchase = await this.purchaseRepository.findOne({
      where: { id, shopId },
      relations: ['supplier', 'items', 'items.product'],
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  // ── Purchase Returns ───────────────────────────────────────
  async createReturn(dto: CreatePurchaseReturnDto, shopId: string, userId: string) {
    const purchase = await this.findOne(dto.purchaseId, shopId);

    const totalAmount = dto.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const amountReceivedFromSupplier = dto.amountReceivedFromSupplier ?? totalAmount;
    const amountToAccount = totalAmount - amountReceivedFromSupplier;

    if (amountReceivedFromSupplier > totalAmount) {
      throw new BadRequestException('Amount received cannot exceed total return amount');
    }

    const refNum = await this.generateReturnNumber(shopId);
    const savedReturn = await this.returnRepository.save(
      this.returnRepository.create({
        referenceNumber: refNum,
        purchaseId: dto.purchaseId,
        supplierId: purchase.supplierId,
        status: PurchaseReturnStatus.COMPLETED,
        totalAmount,
        amountReceivedFromSupplier,
        amountToAccount,
        reason: dto.reason,
        notes: dto.notes,
        createdBy: userId,
        shopId,
      }),
    );

    await this.returnItemRepository.save(
      dto.items.map((item) =>
        this.returnItemRepository.create({
          purchaseReturnId: savedReturn.id,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal: item.quantity * item.unitCost,
          reason: item.reason,
          shopId,
        }),
      ),
    );

    // Deduct from inventory
    for (const item of dto.items) {
      await this.inventoryService.adjustStock(
        {
          productId: item.productId,
          quantity: item.quantity,
          movementType: InventoryMovementType.RETURN_OUT,
          unitCost: item.unitCost,
          referenceId: savedReturn.referenceNumber,
          referenceType: 'purchase_return',
          performedBy: userId,
        },
        shopId,
      );
    }

    // Record cash received from supplier as income
    if (amountReceivedFromSupplier > 0) {
      await this.expensesService.recordSystemExpense(
        {
          typeName: 'Purchase Return',
          title: `Purchase Return: ${refNum}`,
          amount: amountReceivedFromSupplier,
          referenceId: savedReturn.id,
          referenceType: 'purchase_return',
          isIncome: true,
        },
        shopId,
        userId,
      );
    }

    // Credit remainder to supplier account (reduces what we owe)
    if (amountToAccount > 0 && purchase.supplierId) {
      const prevBalance = await this.getSupplierBalance(purchase.supplierId, shopId);
      const balanceAfter = Math.max(0, prevBalance - amountToAccount);
      await this.ledgerRepository.save(
        this.ledgerRepository.create({
          supplierId: purchase.supplierId,
          type: SupplierLedgerType.PURCHASE_RETURN_CREDIT,
          amount: amountToAccount,
          balanceAfter,
          referenceType: 'purchase_return',
          referenceId: savedReturn.id,
          description: `Return credit: ${refNum}`,
          createdBy: userId,
          shopId,
        }),
      );
      await this.supplierRepository.decrement({ id: purchase.supplierId }, 'totalDue', amountToAccount);
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
    return { data, message: 'Purchase returns fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  private async generateReferenceNumber(prefix: string, shopId: string): Promise<string> {
    const date = new Date();
    const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const count = await this.purchaseRepository.count({ where: { shopId } });
    return `${prefix}-${yyyymmdd}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateReturnNumber(shopId: string): Promise<string> {
    const date = new Date();
    const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const count = await this.returnRepository.count({ where: { shopId } });
    return `SRN-${yyyymmdd}-${String(count + 1).padStart(4, '0')}`;
  }
}
