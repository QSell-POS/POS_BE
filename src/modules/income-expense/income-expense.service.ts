import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncomeExpense, TransactionType } from './entities/income-expense.entity';
import { CreateIncomeExpenseDto, UpdateIncomeExpenseDto, IncomeExpenseFilterDto } from './dto/income-expense.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

@Injectable()
export class IncomeExpenseService {
  constructor(
    @InjectRepository(IncomeExpense)
    private repository: Repository<IncomeExpense>,
  ) {}

  async create(dto: CreateIncomeExpenseDto, shopId: string, userId: string) {
    const record = this.repository.create({
      ...dto,
      transactionDate: dto.transactionDate ? new Date(dto.transactionDate) : new Date(),
      recordedBy: userId,
      shopId,
    });
    return this.repository.save(record);
  }

  async findAll(filters: IncomeExpenseFilterDto, shopId: string) {
    const { transactionType, category, startDate, endDate, page = 1, limit = 20 } = filters;

    const qb = this.repository
      .createQueryBuilder('ie')
      .leftJoinAndSelect('ie.recordedByUser', 'user')
      .where('ie.shopId = :shopId', { shopId });

    if (transactionType) qb.andWhere('ie.transactionType = :transactionType', { transactionType });
    if (category) qb.andWhere('ie.category = :category', { category });
    if (startDate) qb.andWhere('ie.transactionDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('ie.transactionDate <= :endDate', { endDate });

    const total = await qb.getCount();
    const rawData = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('ie.transactionDate', 'DESC')
      .getMany();

    const data = rawData.map((ie) => ({
      ...ie,
      recordedByUser: `${ie.recordedByUser.firstName} ${ie.recordedByUser.lastName}`,
    }));

    // Summary
    const summary = await this.repository
      .createQueryBuilder('ie')
      .select(['ie.transactionType as "transactionType"', 'SUM(ie.amount) as total'])
      .where('ie.shopId = :shopId', { shopId })
      .groupBy('ie.transactionType')
      .getRawMany();

    const totalIncome = summary.find((s) => s.transactionType === TransactionType.INCOME)?.total || 0;
    const totalExpense = summary.find((s) => s.transactionType === TransactionType.EXPENSE)?.total || 0;

    return {
      data,
      message: 'Income & expense records fetched successfully',
      meta: {
        ...buildPaginationMeta(total, page, limit),
        summary: {
          totalIncome: Number(totalIncome),
          totalExpense: Number(totalExpense),
          netBalance: Number(totalIncome) - Number(totalExpense),
        },
      },
    };
  }

  async findOne(id: string, shopId: string) {
    const record = await this.repository.findOne({ where: { id, shopId } });
    if (!record) throw new NotFoundException('Record not found');
    return record;
  }

  async update(id: string, dto: UpdateIncomeExpenseDto, shopId: string) {
    const record = await this.findOne(id, shopId);
    Object.assign(record, dto);
    return this.repository.save(record);
  }

  async remove(id: string, shopId: string) {
    await this.findOne(id, shopId);
    await this.repository.softDelete(id);
    return { message: 'Record deleted' };
  }

  async getSummaryByPeriod(shopId: string, startDate: string, endDate: string) {
    const rows = await this.repository
      .createQueryBuilder('ie')
      .select(['ie.category as category', 'ie.transactionType as "transactionType"', 'SUM(ie.amount) as total', 'COUNT(*) as count'])
      .where('ie.shopId = :shopId', { shopId })
      .andWhere('ie.transactionDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('ie.category, ie.transactionType')
      .orderBy('total', 'DESC')
      .getRawMany();

    return rows;
  }
}
