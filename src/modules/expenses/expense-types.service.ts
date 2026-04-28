import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseType } from './entities/expense-type.entity';
import { CreateExpenseTypeDto, UpdateExpenseTypeDto, ExpenseTypeFilterDto } from './dto/expense-type.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

@Injectable()
export class ExpenseTypesService {
  constructor(
    @InjectRepository(ExpenseType)
    private readonly repo: Repository<ExpenseType>,
  ) {}

  async create(dto: CreateExpenseTypeDto, shopId: string) {
    const existing = await this.repo.findOne({ where: { shopId, name: dto.name } });
    if (existing) throw new ConflictException(`Expense type "${dto.name}" already exists`);
    const record = this.repo.create({ ...dto, shopId });
    const saved = await this.repo.save(record);
    return { data: saved, message: 'Expense type created' };
  }

  async findAll(filters: ExpenseTypeFilterDto, shopId: string) {
    const { page = 1, limit = 20, search, isActive } = filters;

    const qb = this.repo.createQueryBuilder('et').where('et.shopId = :shopId', { shopId });
    if (search) qb.andWhere('et.name ILIKE :search', { search: `%${search}%` });
    if (isActive !== undefined) qb.andWhere('et.isActive = :isActive', { isActive });

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('et.name', 'ASC')
      .getMany();

    return {
      data,
      message: 'Expense types fetched successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, shopId: string) {
    const record = await this.repo.findOne({ where: { id, shopId } });
    if (!record) throw new NotFoundException('Expense type not found');
    return { data: record, message: 'Expense type fetched successfully' };
  }

  async update(id: string, dto: UpdateExpenseTypeDto, shopId: string) {
    const result = await this.findOne(id, shopId);
    Object.assign(result.data, dto);
    const saved = await this.repo.save(result.data);
    return { data: saved, message: 'Expense type updated' };
  }

  async remove(id: string, shopId: string) {
    await this.findOne(id, shopId);
    await this.repo.softDelete(id);
    return { data: null, message: 'Expense type deleted' };
  }

  async getOrCreateByName(name: string, shopId: string): Promise<ExpenseType> {
    let record = await this.repo.findOne({ where: { shopId, name } });
    if (!record) {
      record = await this.repo.save(this.repo.create({ name, shopId, isActive: true }));
    }
    return record;
  }
}
