import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../purchases/entities/supplier.entity';
import { SupplierLedger, SupplierLedgerType } from '../purchases/entities/supplier-ledger.entity';
import { SupplierPayment } from '../purchases/entities/supplier-payment.entity';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { ExpensesService } from '../expenses/expenses.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateSupplierPaymentDto,
  SupplierFilterDto,
} from '../purchases/dto/purchase.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(SupplierLedger)
    private ledgerRepository: Repository<SupplierLedger>,
    @InjectRepository(SupplierPayment)
    private paymentRepository: Repository<SupplierPayment>,
    private expensesService: ExpensesService,
  ) {}

  async create(dto: CreateSupplierDto, shopId: string) {
    const supplier = this.supplierRepository.create({ ...dto, shopId });
    return this.supplierRepository.save(supplier);
  }

  async findAll(shopId: string, filters: SupplierFilterDto) {
    const { search, page = 1, limit = 20 } = filters;
    const qb = this.supplierRepository.createQueryBuilder('s').where('s.shopId = :shopId', { shopId });
    if (search) {
      qb.andWhere('(s.name ILIKE :search OR s.contactPerson ILIKE :search OR s.phone ILIKE :search)', { search: `%${search}%` });
    }
    const total = await qb.getCount();
    const data = await qb.orderBy('s.name', 'ASC').skip((page - 1) * limit).take(limit).getMany();
    return { data, message: 'Suppliers fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, shopId: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id, shopId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto, shopId: string) {
    const supplier = await this.findOne(id, shopId);
    Object.assign(supplier, dto);
    return this.supplierRepository.save(supplier);
  }

  async getLedger(supplierId: string, shopId: string, page = 1, limit = 20) {
    await this.findOne(supplierId, shopId);
    const [data, total] = await this.ledgerRepository.findAndCount({
      where: { supplierId, shopId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, message: 'Supplier ledger fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async getStatement(supplierId: string, shopId: string) {
    const supplier = await this.findOne(supplierId, shopId);
    const ledger = await this.ledgerRepository.find({ where: { supplierId, shopId }, order: { createdAt: 'ASC' } });
    const balance = ledger.length > 0 ? Number(ledger[ledger.length - 1].balanceAfter) : 0;
    return { data: { supplier, balance, transactions: ledger } };
  }

  async recordPayment(dto: CreateSupplierPaymentDto, shopId: string, userId: string) {
    const supplier = await this.findOne(dto.supplierId, shopId);
    const balance = await this.getBalance(dto.supplierId, shopId);

    if (dto.amount > balance) {
      throw new BadRequestException(`Payment (${dto.amount}) exceeds outstanding balance (${balance})`);
    }

    const balanceAfter = balance - dto.amount;

    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
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

  async getBalance(supplierId: string, shopId: string): Promise<number> {
    const last = await this.ledgerRepository.findOne({
      where: { supplierId, shopId },
      order: { createdAt: 'DESC' },
    });
    return last ? Number(last.balanceAfter) : 0;
  }

  async addLedgerEntry(
    entry: {
      supplierId: string;
      type: SupplierLedgerType;
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

  async incrementTotalDue(supplierId: string, amount: number) {
    await this.supplierRepository.increment({ id: supplierId }, 'totalDue', amount);
  }

  async decrementTotalDue(supplierId: string, amount: number) {
    await this.supplierRepository.decrement({ id: supplierId }, 'totalDue', amount);
  }

  async incrementTotalPurchased(supplierId: string, amount: number) {
    await this.supplierRepository.increment({ id: supplierId }, 'totalPurchased', amount);
  }
}
