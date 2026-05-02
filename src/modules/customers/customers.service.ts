import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../sales/entities/customer.entity';
import { CustomerLedger, CustomerLedgerType } from '../sales/entities/customer-ledger.entity';
import { CustomerPayment } from '../sales/entities/customer-payment.entity';
import { PaymentMethod } from '../sales/entities/sale.entity';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { ExpensesService } from '../expenses/expenses.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateCustomerPaymentDto,
} from '../sales/dto/sale.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(CustomerLedger)
    private ledgerRepository: Repository<CustomerLedger>,
    @InjectRepository(CustomerPayment)
    private paymentRepository: Repository<CustomerPayment>,
    private expensesService: ExpensesService,
  ) {}

  async create(dto: CreateCustomerDto, shopId: string) {
    const customer = this.customerRepository.create({ ...dto, shopId });
    return this.customerRepository.save(customer);
  }

  async findAll(shopId: string, search?: string, page = 1, limit = 20) {
    const qb = this.customerRepository.createQueryBuilder('c').where('c.shopId = :shopId', { shopId });
    if (search) {
      qb.andWhere('(c.name ILIKE :search OR c.phone ILIKE :search OR c.email ILIKE :search)', { search: `%${search}%` });
    }
    const total = await qb.getCount();
    const data = await qb.skip((page - 1) * limit).take(limit).orderBy('c.name', 'ASC').getMany();
    return { data, message: 'Customers fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, shopId: string) {
    const customer = await this.customerRepository.findOne({ where: { id, shopId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, shopId: string) {
    const customer = await this.findOne(id, shopId);
    Object.assign(customer, dto);
    return this.customerRepository.save(customer);
  }

  async getLedger(customerId: string, shopId: string, page = 1, limit = 20) {
    await this.findOne(customerId, shopId);
    const [data, total] = await this.ledgerRepository.findAndCount({
      where: { customerId, shopId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, message: 'Customer ledger fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async getStatement(customerId: string, shopId: string) {
    const customer = await this.findOne(customerId, shopId);
    const ledger = await this.ledgerRepository.find({ where: { customerId, shopId }, order: { createdAt: 'ASC' } });
    const balance = ledger.length > 0 ? Number(ledger[ledger.length - 1].balanceAfter) : 0;
    return { data: { customer, balance, transactions: ledger } };
  }

  async recordPayment(dto: CreateCustomerPaymentDto, shopId: string, userId: string) {
    const customer = await this.findOne(dto.customerId, shopId);
    const balance = await this.getBalance(dto.customerId, shopId);

    if (dto.amount > balance) {
      throw new BadRequestException(`Payment (${dto.amount}) exceeds outstanding balance (${balance})`);
    }

    const balanceAfter = balance - dto.amount;

    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
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

  async getBalance(customerId: string, shopId: string): Promise<number> {
    const last = await this.ledgerRepository.findOne({
      where: { customerId, shopId },
      order: { createdAt: 'DESC' },
    });
    return last ? Number(last.balanceAfter) : 0;
  }

  async addLedgerEntry(
    entry: {
      customerId: string;
      type: CustomerLedgerType;
      amount: number;
      balanceAfter: number;
      referenceType: string;
      referenceId: string;
      description: string;
      createdBy: string;
    },
    shopId: string,
  ) {
    return this.ledgerRepository.save(this.ledgerRepository.create({ ...entry, shopId }));
  }

  async incrementTotalDue(customerId: string, amount: number) {
    await this.customerRepository.increment({ id: customerId }, 'totalDue', amount);
  }

  async decrementTotalDue(customerId: string, amount: number) {
    await this.customerRepository.decrement({ id: customerId }, 'totalDue', amount);
  }

  async incrementTotalPurchased(customerId: string, amount: number) {
    await this.customerRepository.increment({ id: customerId }, 'totalPurchased', amount);
  }
}
