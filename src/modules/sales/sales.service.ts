import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Sale, SaleItem, SaleStatus } from './entities/sale.entity';
import { SaleReturn, SaleReturnItem, SaleReturnStatus } from './entities/sale-return.entity';
import { Customer } from './entities/customer.entity';
import { CustomerLedger, CustomerLedgerType } from './entities/customer-ledger.entity';
import { CustomerPayment } from './entities/customer-payment.entity';
import {
  CreateSaleDto,
  UpdateSaleDto,
  CreateSaleReturnDto,
  CreateCustomerDto,
  UpdateCustomerDto,
  SaleFilterDto,
  CreateCustomerPaymentDto,
} from './dto/sale.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { ProductsService } from '../products/products.service';
import { PriceType } from '../products/entities/product-price.entity';
import { ExpensesService } from '../expenses/expenses.service';
import { PaymentMethod } from './entities/sale.entity';

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
    @InjectRepository(CustomerLedger)
    private ledgerRepository: Repository<CustomerLedger>,
    @InjectRepository(CustomerPayment)
    private customerPaymentRepository: Repository<CustomerPayment>,
    private inventoryService: InventoryService,
    private productsService: ProductsService,
    private expensesService: ExpensesService,
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

  // ── Customer Ledger ────────────────────────────────────────
  async getCustomerLedger(customerId: string, shopId: string, page = 1, limit = 20) {
    await this.getCustomer(customerId, shopId);
    const [data, total] = await this.ledgerRepository.findAndCount({
      where: { customerId, shopId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      message: 'Customer ledger fetched successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getCustomerStatement(customerId: string, shopId: string) {
    const customer = await this.getCustomer(customerId, shopId);
    const ledger = await this.ledgerRepository.find({
      where: { customerId, shopId },
      order: { createdAt: 'ASC' },
    });
    const balance = ledger.length > 0 ? Number(ledger[ledger.length - 1].balanceAfter) : 0;
    return {
      data: {
        customer,
        balance,
        transactions: ledger,
      },
    };
  }

  async recordCustomerPayment(dto: CreateCustomerPaymentDto, shopId: string, userId: string) {
    const customer = await this.getCustomer(dto.customerId, shopId);

    const balance = await this.getCustomerBalance(dto.customerId, shopId);
    if (dto.amount > balance) {
      throw new BadRequestException(`Payment (${dto.amount}) exceeds outstanding balance (${balance})`);
    }

    const balanceAfter = balance - dto.amount;

    const payment = await this.customerPaymentRepository.save(
      this.customerPaymentRepository.create({
        customerId: dto.customerId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
        notes: dto.notes,
        createdBy: userId,
        shopId,
      }),
    );

    await this.ledgerRepository.save(
      this.ledgerRepository.create({
        customerId: dto.customerId,
        type: CustomerLedgerType.PAYMENT_RECEIVED,
        amount: dto.amount,
        balanceAfter,
        referenceType: 'customer_payment',
        referenceId: payment.id,
        description: `Payment received`,
        createdBy: userId,
        shopId,
      }),
    );

    await this.customerRepository.update(dto.customerId, { totalDue: balanceAfter });

    await this.expensesService.recordSystemExpense(
      {
        typeName: 'Customer Payment',
        title: `Customer payment: ${customer.name}`,
        amount: dto.amount,
        referenceId: payment.id,
        referenceType: 'customer_payment',
        isIncome: true,
      },
      shopId,
      userId,
    );

    return { data: payment, message: 'Payment recorded successfully' };
  }

  private async getCustomerBalance(customerId: string, shopId: string): Promise<number> {
    const last = await this.ledgerRepository.findOne({
      where: { customerId, shopId },
      order: { createdAt: 'DESC' },
    });
    return last ? Number(last.balanceAfter) : 0;
  }

  // ── Sales ──────────────────────────────────────────────────
  async create(dto: CreateSaleDto, shopId: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let subtotal = 0;
      let totalTax = 0;
      let totalProfit = 0;
      let totalCogs = 0;
      const enrichedItems = [];

      for (const item of dto.items) {
        const product = await this.productsService.findOne(item.productId, shopId);

        const inv = product.inventoryItems?.[0];
        if (product.trackInventory && inv && Number(inv.quantityAvailable) < item.quantity) {
          throw new BadRequestException(`Insufficient stock for "${product.name}". Available: ${inv.quantityAvailable}`);
        }

        const retailPrice = item.unitPrice ?? (await this.productsService.getCurrentPrice(item.productId, PriceType.RETAIL, shopId));

        // Use FIFO to determine actual cost of goods sold for this line item
        const lineCogs = await this.inventoryService.consumeBatchesFIFO(item.productId, shopId, item.quantity, queryRunner);
        const costPrice = item.quantity > 0 ? lineCogs / item.quantity : 0;

        const discountAmount = (retailPrice * item.quantity * (item.discountRate || 0)) / 100;
        const lineSubtotal = retailPrice * item.quantity - discountAmount;
        const taxAmount = (lineSubtotal * Number(product.taxRate)) / 100;
        const lineProfit = lineSubtotal - lineCogs;

        subtotal += lineSubtotal;
        totalTax += taxAmount;
        totalProfit += lineProfit;
        totalCogs += lineCogs;

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
      const creditAmount = dto.creditAmount || 0;
      const totalProfitFinal = totalProfit - discountAmount;

      if (creditAmount > grandTotal) {
        throw new BadRequestException('Credit amount cannot exceed grand total');
      }
      if (creditAmount > 0 && !dto.customerId) {
        throw new BadRequestException('A customer must be selected for credit sales');
      }

      const invoiceNumber = await this.generateInvoiceNumber(shopId);

      const sale = queryRunner.manager.create(Sale, {
        invoiceNumber,
        customerId: dto.customerId,
        paymentMethod: dto.paymentMethod,
        subtotal,
        taxAmount: totalTax,
        discountAmount,
        grandTotal,
        creditAmount,
        profit: totalProfitFinal,
        status: SaleStatus.COMPLETED,
        servedByUserId: userId,
        notes: dto.notes,
        shopId,
      });

      const savedSale = await queryRunner.manager.save(Sale, sale);

      const saleItems = enrichedItems.map((item) => queryRunner.manager.create(SaleItem, { ...item, saleId: savedSale.id }));
      await queryRunner.manager.save(SaleItem, saleItems);

      await queryRunner.commitTransaction();

      // Adjust inventory stock quantities
      for (const item of enrichedItems) {
        await this.inventoryService.adjustStock(
          {
            productId: item.productId,
            quantity: item.quantity,
            movementType: InventoryMovementType.SALE,
            unitCost: item.costPrice,
            referenceId: savedSale.invoiceNumber,
            referenceType: 'sale',
            performedBy: userId,
          },
          shopId,
        );
      }

      // Record COGS as expense when goods are sold
      if (totalCogs > 0) {
        await this.expensesService.recordSystemExpense(
          {
            typeName: 'Cost of Goods Sold',
            title: `COGS: ${invoiceNumber}`,
            amount: totalCogs,
            referenceId: savedSale.id,
            referenceType: 'sale',
          },
          shopId,
          userId,
        );
      }

      // Customer ledger entry for credit portion
      if (creditAmount > 0 && dto.customerId) {
        const prevBalance = await this.getCustomerBalance(dto.customerId, shopId);
        const balanceAfter = prevBalance + creditAmount;
        await this.ledgerRepository.save(
          this.ledgerRepository.create({
            customerId: dto.customerId,
            type: CustomerLedgerType.SALE_CREDIT,
            amount: creditAmount,
            balanceAfter,
            referenceType: 'sale',
            referenceId: savedSale.id,
            description: `Credit sale: ${invoiceNumber}`,
            createdBy: userId,
            shopId,
          }),
        );
        await this.customerRepository.increment({ id: dto.customerId }, 'totalDue', creditAmount);
      }

      if (dto.customerId) {
        await this.customerRepository.increment({ id: dto.customerId }, 'totalPurchased', grandTotal);
      }

      return this.findOne(savedSale.id, shopId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(filters: SaleFilterDto, shopId: string) {
    const { search, customerId, status, startDate, endDate, page = 1, limit = 20 } = filters;

    const qb = this.saleRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.customer', 'customer')
      .leftJoinAndSelect('s.servedByUser', 'servedByUser')
      .where('s.shopId = :shopId', { shopId });

    if (search) qb.andWhere('s.invoiceNumber ILIKE :search', { search: `%${search}%` });
    if (customerId) qb.andWhere('s.customerId = :customerId', { customerId });
    if (status) qb.andWhere('s.status = :status', { status });
    if (startDate) qb.andWhere('s.saleDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('s.saleDate <= :endDate', { endDate });

    const total = await qb.getCount();
    const rawData = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('s.createdAt', 'DESC')
      .getMany();

    const data = rawData.map(({ servedByUser, ...sale }) => ({
      ...sale,
      servedBy: servedByUser ? `${servedByUser.firstName} ${servedByUser.lastName}` : null,
    }));

    return {
      data,
      message: 'Sales fetched successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, shopId: string) {
    const sale = await this.saleRepository.findOne({
      where: { id, shopId },
      relations: ['customer', 'items', 'items.product', 'servedByUser'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    const { servedByUser, items, ...rest } = sale;
    const mappedItems = items.map(({ product, ...item }) => ({
      ...item,
      productName: product?.name ?? null,
      productSku: product?.sku ?? null,
    }));
    return {
      ...rest,
      items: mappedItems,
      servedBy: servedByUser ? `${servedByUser.firstName} ${servedByUser.lastName}` : null,
    };
  }

  async cancelSale(id: string, shopId: string, userId: string) {
    const sale = await this.findOne(id, shopId);
    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Only completed sales can be cancelled');
    }

    await this.saleRepository.update(id, { status: SaleStatus.CANCELLED });

    for (const item of sale.items) {
      await this.inventoryService.adjustStock(
        {
          productId: item.productId,
          quantity: item.quantity,
          movementType: InventoryMovementType.RETURN_IN,
          referenceId: sale.invoiceNumber,
          referenceType: 'sale_cancel',
          performedBy: userId,
        },
        shopId,
      );
    }

    // Reverse credit ledger entry if applicable
    if (Number(sale.creditAmount) > 0 && sale.customerId) {
      const prevBalance = await this.getCustomerBalance(sale.customerId, shopId);
      const balanceAfter = Math.max(0, prevBalance - Number(sale.creditAmount));
      await this.ledgerRepository.save(
        this.ledgerRepository.create({
          customerId: sale.customerId,
          type: CustomerLedgerType.ADJUSTMENT,
          amount: Number(sale.creditAmount),
          balanceAfter,
          referenceType: 'sale_cancel',
          referenceId: id,
          description: `Sale cancelled: ${sale.invoiceNumber}`,
          createdBy: userId,
          shopId,
        }),
      );
      await this.customerRepository.decrement({ id: sale.customerId }, 'totalDue', Number(sale.creditAmount));
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
    const amountPaidToCustomer = dto.amountPaidToCustomer ?? totalAmount;
    const amountToAccount = totalAmount - amountPaidToCustomer;

    if (amountPaidToCustomer > totalAmount) {
      throw new BadRequestException('Amount paid to customer cannot exceed total return amount');
    }

    const refNum = await this.generateReturnNumber(shopId);
    const savedReturn = await this.returnRepository.save(
      this.returnRepository.create({
        referenceNumber: refNum,
        saleId: dto.saleId,
        customerId: sale.customerId,
        status: SaleReturnStatus.COMPLETED,
        totalAmount,
        amountPaidToCustomer,
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
          saleReturnId: savedReturn.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
          reason: item.reason,
          shopId,
        }),
      ),
    );

    // Restore inventory
    for (const item of dto.items) {
      await this.inventoryService.adjustStock(
        {
          productId: item.productId,
          quantity: item.quantity,
          movementType: InventoryMovementType.RETURN_IN,
          referenceId: savedReturn.referenceNumber,
          referenceType: 'sale_return',
          performedBy: userId,
        },
        shopId,
      );
    }

    // Record cash paid out as expense
    if (amountPaidToCustomer > 0) {
      await this.expensesService.recordSystemExpense(
        {
          typeName: 'Sale Return',
          title: `Sale Return: ${refNum}`,
          amount: amountPaidToCustomer,
          referenceId: savedReturn.id,
          referenceType: 'sale_return',
        },
        shopId,
        userId,
      );
    }

    // Credit remainder to customer account (reduces their balance)
    if (amountToAccount > 0 && sale.customerId) {
      const prevBalance = await this.getCustomerBalance(sale.customerId, shopId);
      const balanceAfter = Math.max(0, prevBalance - amountToAccount);
      await this.ledgerRepository.save(
        this.ledgerRepository.create({
          customerId: sale.customerId,
          type: CustomerLedgerType.SALE_RETURN_CREDIT,
          amount: amountToAccount,
          balanceAfter,
          referenceType: 'sale_return',
          referenceId: savedReturn.id,
          description: `Return credit: ${refNum}`,
          createdBy: userId,
          shopId,
        }),
      );
      await this.customerRepository.decrement({ id: sale.customerId }, 'totalDue', amountToAccount);
    }

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
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const count = await this.saleRepository
      .createQueryBuilder('s')
      .where('s.shopId = :shopId', { shopId })
      .andWhere('s.saleDate BETWEEN :start AND :end', { start, end })
      .getCount();
    return `INV-${yyyymmdd}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateReturnNumber(shopId: string): Promise<string> {
    const date = new Date();
    const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const count = await this.returnRepository.count({ where: { shopId } });
    return `SRN-${yyyymmdd}-${String(count + 1).padStart(4, '0')}`;
  }
}
