import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Sale, SaleItem, SaleStatus, SalePaymentStatus } from './entities/sale.entity';
import { SaleReturn, SaleReturnItem, SaleReturnStatus } from './entities/sale-return.entity';
import { Customer } from './entities/customer.entity';
import { CreateSaleDto, UpdateSaleDto, CreateSaleReturnDto, CreateCustomerDto, UpdateCustomerDto, SaleFilterDto } from './dto/sale.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { ProductsService } from '../products/products.service';
import { PriceType } from '../products/entities/product-price.entity';
import { IncomeExpenseService } from '../income-expense/income-expense.service';
import { TransactionType, IncomeExpenseCategory } from '../income-expense/entities/income-expense.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(SaleReturn)
    private returnRepository: Repository<SaleReturn>,
    @InjectRepository(SaleReturnItem)
    private returnItemRepository: Repository<SaleReturnItem>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private inventoryService: InventoryService,
    private productsService: ProductsService,
    private incomeExpenseService: IncomeExpenseService,
    private dataSource: DataSource,
  ) {}

  // ── Customers ─────────────────────────────────────────────
  async createCustomer(dto: CreateCustomerDto, shopId: string) {
    const customer = this.customerRepository.create({ ...dto, shopId });
    return this.customerRepository.save(customer);
  }

  async getCustomers(shopId: string, search?: string, page = 1, limit = 20) {
    const qb = this.customerRepository.createQueryBuilder('c').where('c.shopId = :shopId', { shopId });
    if (search) {
      qb.andWhere('(c.name ILIKE :search OR c.phone ILIKE :search OR c.email ILIKE :search)', { search: `%${search}%` });
    }
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('c.name', 'ASC')
      .getMany();
    return {
      data,
      message: 'Customers fetched successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getCustomer(id: string, shopId: string) {
    const c = await this.customerRepository.findOne({ where: { id, shopId } });
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto, shopId: string) {
    const customer = await this.getCustomer(id, shopId);
    Object.assign(customer, dto);
    return this.customerRepository.save(customer);
  }

  // ── Sales ──────────────────────────────────────────────────
  async create(dto: CreateSaleDto, shopId: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Build items with prices and cost
      let subtotal = 0;
      let totalTax = 0;
      let totalProfit = 0;
      const enrichedItems = [];

      for (const item of dto.items) {
        const product = await this.productsService.findOne(item.productId, shopId);

        // Check stock
        const inv = product.inventoryItems?.[0];
        if (product.trackInventory && inv && Number(inv.quantityAvailable) < item.quantity) {
          throw new BadRequestException(`Insufficient stock for "${product.name}". Available: ${inv.quantityAvailable}`);
        }

        const retailPrice = item.unitPrice ?? (await this.productsService.getCurrentPrice(item.productId, PriceType.RETAIL, shopId));
        const costPrice = inv ? Number(inv.averageCost) : 0;

        const discountAmount = (retailPrice * item.quantity * (item.discountRate || 0)) / 100;
        const lineSubtotal = retailPrice * item.quantity - discountAmount;
        const taxAmount = (lineSubtotal * Number(product.taxRate)) / 100;
        const lineProfit = (retailPrice - costPrice) * item.quantity - discountAmount;

        subtotal += lineSubtotal;
        totalTax += taxAmount;
        totalProfit += lineProfit;

        enrichedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: retailPrice,
          costPrice,
          taxRate: product.taxRate,
          taxAmount,
          discountRate: item.discountRate || 0,
          discountAmount,
          subtotal: lineSubtotal,
          profit: lineProfit,
          shopId,
        });
      }

      const discountAmount = dto.discountAmount || 0;
      const grandTotal = subtotal + totalTax - discountAmount;
      const paidAmount = dto.paidAmount ?? grandTotal;
      const changeAmount = Math.max(0, paidAmount - grandTotal);
      const dueAmount = Math.max(0, grandTotal - paidAmount);
      const totalProfitFinal = totalProfit - discountAmount;

      const invoiceNumber = await this.generateInvoiceNumber(shopId);

      const sale = queryRunner.manager.create(Sale, {
        invoiceNumber,
        customerId: dto.customerId,
        paymentMethod: dto.paymentMethod,
        subtotal,
        taxAmount: totalTax,
        discountAmount,
        grandTotal,
        paidAmount,
        changeAmount,
        dueAmount,
        profit: totalProfitFinal,
        status: SaleStatus.COMPLETED,
        paymentStatus: dueAmount > 0 ? SalePaymentStatus.PARTIAL : SalePaymentStatus.PAID,
        servedBy: userId,
        notes: dto.notes,
        shopId,
      });

      const savedSale = await queryRunner.manager.save(Sale, sale);

      // Save items
      const saleItems = enrichedItems.map((item) =>
        queryRunner.manager.create(SaleItem, {
          ...item,
          saleId: savedSale.id,
        }),
      );
      await queryRunner.manager.save(SaleItem, saleItems);

      // Deduct inventory and update customer stats in parallel
      await queryRunner.commitTransaction();

      // Post-commit: adjust inventory
      for (const item of enrichedItems) {
        await this.inventoryService.adjustStock(
          {
            productId: item.productId,
            quantity: item.quantity,
            movementType: InventoryMovementType.SALE,
            unitCost: item.costPrice,
            referenceId: savedSale.id,
            referenceType: 'sale',
            performedBy: userId,
          },
          shopId,
        );
      }

      // Update customer totals
      if (dto.customerId) {
        await this.customerRepository.increment({ id: dto.customerId }, 'totalPurchased', grandTotal);
        if (dueAmount > 0) {
          await this.customerRepository.increment({ id: dto.customerId }, 'totalDue', dueAmount);
        }
      }

      // Record income
      await this.incomeExpenseService.create(
        {
          transactionType: TransactionType.INCOME,
          category: IncomeExpenseCategory.SALES_REVENUE,
          title: `Sale: ${invoiceNumber}`,
          amount: grandTotal,
          referenceId: savedSale.id,
          referenceType: 'sale',
        },
        shopId,
        userId,
      );

      return this.findOne(savedSale.id, shopId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(filters: SaleFilterDto, shopId: string) {
    const { search, customerId, status, paymentStatus, startDate, endDate, page = 1, limit = 20 } = filters;

    const qb = this.saleRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.customer', 'customer')
      .where('s.shopId = :shopId', { shopId });

    if (search) qb.andWhere('s.invoiceNumber ILIKE :search', { search: `%${search}%` });
    if (customerId) qb.andWhere('s.customerId = :customerId', { customerId });
    if (status) qb.andWhere('s.status = :status', { status });
    if (paymentStatus) qb.andWhere('s.paymentStatus = :paymentStatus', { paymentStatus });
    if (startDate) qb.andWhere('s.saleDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('s.saleDate <= :endDate', { endDate });

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('s.createdAt', 'DESC')
      .getMany();

    return {
      data,
      message: 'Sales fetched successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, shopId: string) {
    const sale = await this.saleRepository.findOne({
      where: { id, shopId },
      relations: ['customer', 'items'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  async recordPayment(id: string, amount: number, shopId: string) {
    const sale = await this.findOne(id, shopId);
    const newPaid = Number(sale.paidAmount) + amount;
    if (newPaid > Number(sale.grandTotal)) {
      throw new BadRequestException('Payment exceeds total amount');
    }
    const dueAmount = Number(sale.grandTotal) - newPaid;
    await this.saleRepository.update(id, {
      paidAmount: newPaid,
      dueAmount,
      changeAmount: Math.max(0, newPaid - Number(sale.grandTotal)),
      paymentStatus: dueAmount === 0 ? SalePaymentStatus.PAID : SalePaymentStatus.PARTIAL,
    });
    return this.findOne(id, shopId);
  }

  async cancelSale(id: string, shopId: string, userId: string) {
    const sale = await this.findOne(id, shopId);
    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Only completed sales can be cancelled');
    }

    await this.saleRepository.update(id, { status: SaleStatus.CANCELLED });

    // Restore inventory
    for (const item of sale.items) {
      await this.inventoryService.adjustStock(
        {
          productId: item.productId,
          quantity: item.quantity,
          movementType: InventoryMovementType.RETURN_IN,
          referenceId: id,
          referenceType: 'sale_cancel',
          performedBy: userId,
        },
        shopId,
      );
    }

    return this.findOne(id, shopId);
  }

  // ── Sale Returns ───────────────────────────────────────────
  async createReturn(dto: CreateSaleReturnDto, shopId: string, userId: string) {
    const sale = await this.findOne(dto.saleId, shopId);
    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('Cannot return a cancelled sale');
    }

    const totalAmount = dto.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    const refNum = await this.generateReturnNumber(shopId);
    const ret = this.returnRepository.create({
      referenceNumber: refNum,
      saleId: dto.saleId,
      customerId: sale.customerId,
      refundMethod: dto.refundMethod as any,
      status: SaleReturnStatus.COMPLETED,
      totalAmount,
      reason: dto.reason,
      notes: dto.notes,
      createdBy: userId,
      shopId,
    });

    const savedReturn = await this.returnRepository.save(ret);

    const items = dto.items.map((item) =>
      this.returnItemRepository.create({
        saleReturnId: savedReturn.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.quantity * item.unitPrice,
        reason: item.reason,
        shopId,
      }),
    );
    await this.returnItemRepository.save(items);

    // Return stock
    for (const item of dto.items) {
      await this.inventoryService.adjustStock(
        {
          productId: item.productId,
          quantity: item.quantity,
          movementType: InventoryMovementType.RETURN_IN,
          referenceId: savedReturn.id,
          referenceType: 'sale_return',
          performedBy: userId,
        },
        shopId,
      );
    }

    // Update sale status
    await this.saleRepository.update(dto.saleId, {
      status: SaleStatus.PARTIAL_REFUND,
    });

    // Record income reduction
    await this.incomeExpenseService.create(
      {
        transactionType: TransactionType.EXPENSE,
        category: IncomeExpenseCategory.RETURN_INCOME,
        title: `Sale Return: ${refNum}`,
        amount: totalAmount,
        referenceId: savedReturn.id,
        referenceType: 'sale_return',
      },
      shopId,
      userId,
    );

    return savedReturn;
  }

  async getReturns(shopId: string, page = 1, limit = 20) {
    const [data, total] = await this.returnRepository.findAndCount({
      where: { shopId },
      relations: ['customer', 'sale', 'items'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      message: 'Sale returns fetched successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  private async generateInvoiceNumber(shopId: string): Promise<string> {
    const date = new Date();
    const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    // start of today
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    // end of today
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const count = await this.saleRepository
      .createQueryBuilder('s')
      .where('s.shopId = :shopId', { shopId })
      .andWhere('s.saleDate BETWEEN :start AND :end', {
        start,
        end,
      })
      .getCount();

    return `INV-${yyyymmdd}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateReturnNumber(shopId: string): Promise<string> {
    const date = new Date();
    const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.returnRepository.count({ where: { shopId } });
    return `SRN-${yyyymm}-${String(count + 1).padStart(4, '0')}`;
  }
}
