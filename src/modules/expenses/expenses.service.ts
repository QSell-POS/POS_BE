import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './dto/expense.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { ExpenseTypesService } from './expense-types.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly repo: Repository<Expense>,
    private readonly expenseTypesService: ExpenseTypesService,
  ) {}

  async create(dto: CreateExpenseDto, shopId: string, userId: string) {
    const record = this.repo.create({
      ...dto,
      transactionDate: dto.transactionDate ? new Date(dto.transactionDate) : new Date(),
      recordedBy: userId,
      shopId,
    });
    const saved = await this.repo.save(record);
    return { data: saved, message: 'Expense recorded successfully' };
  }

  async recordSystemExpense(
    payload: {
      typeName: string;
      title: string;
      amount: number;
      referenceId?: string;
      referenceType?: string;
    },
    shopId: string,
    userId: string,
  ) {
    const type = await this.expenseTypesService.getOrCreateByName(payload.typeName, shopId);
    const record = this.repo.create({
      expenseTypeId: type.id,
      title: payload.title,
      amount: payload.amount,
      referenceId: payload.referenceId,
      referenceType: payload.referenceType,
      transactionDate: new Date(),
      recordedBy: userId,
      shopId,
    });
    return this.repo.save(record);
  }

  async findAll(filters: ExpenseFilterDto, shopId: string) {
    const { expenseTypeId, startDate, endDate, page = 1, limit = 20 } = filters;

    const qb = this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.recordedByUser', 'user')
      .leftJoinAndSelect('e.expenseType', 'type')
      .where('e.shopId = :shopId', { shopId });

    if (expenseTypeId) qb.andWhere('e.expenseTypeId = :expenseTypeId', { expenseTypeId });
    if (startDate) qb.andWhere('e.transactionDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('e.transactionDate <= :endDate', { endDate });

    const total = await qb.getCount();
    const rawData = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('e.transactionDate', 'DESC')
      .getMany();

    const data = rawData.map((e) => ({
      ...e,
      recordedByUser: e.recordedByUser ? `${e.recordedByUser.firstName} ${e.recordedByUser.lastName}` : null,
    }));

    const summary = await this.repo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount),0)', 'totalExpense')
      .where('e.shopId = :shopId', { shopId })
      .getRawOne();

    return {
      data,
      message: 'Expenses fetched successfully',
      meta: {
        ...buildPaginationMeta(total, page, limit),
        summary: { totalExpense: Number(summary.totalExpense) },
      },
    };
  }

  async findOne(id: string, shopId: string) {
    const record = await this.repo.findOne({
      where: { id, shopId },
      relations: ['expenseType', 'recordedByUser'],
    });
    if (!record) throw new NotFoundException('Expense not found');
    return { data: record, message: 'Expense fetched successfully' };
  }

  async update(id: string, dto: UpdateExpenseDto, shopId: string) {
    const result = await this.findOne(id, shopId);
    Object.assign(result.data, dto);
    if (dto.transactionDate) result.data.transactionDate = new Date(dto.transactionDate);
    const saved = await this.repo.save(result.data);
    return { data: saved, message: 'Expense updated' };
  }

  async remove(id: string, shopId: string) {
    await this.findOne(id, shopId);
    await this.repo.softDelete(id);
    return { data: null, message: 'Expense deleted' };
  }

  async getSummaryByPeriod(shopId: string, startDate: string, endDate: string) {
    const rows = await this.repo
      .createQueryBuilder('e')
      .leftJoin('e.expenseType', 'type')
      .select('type.name', 'expenseType')
      .addSelect('e.expenseTypeId', 'expenseTypeId')
      .addSelect('SUM(e.amount)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('e.shopId = :shopId', { shopId })
      .andWhere('e.transactionDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('type.name')
      .addGroupBy('e.expenseTypeId')
      .orderBy('total', 'DESC')
      .getRawMany();

    return {
      data: rows.map((r) => ({
        ...r,
        total: Number(r.total),
        count: Number(r.count),
      })),
      message: 'Expense summary fetched successfully',
    };
  }
}
