import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditFilterDto } from './dto/audit-filter.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(data: Partial<AuditLog>): Promise<void> {
    const entry = this.repo.create(data);
    await this.repo.save(entry).catch(() => {});
  }

  async findAll(shopId: string, filters: AuditFilterDto) {
    const { page = 1, limit = 20, entity, userId, action, startDate, endDate } = filters;

    const qb = this.repo
      .createQueryBuilder('al')
      .where('al.shopId = :shopId', { shopId });

    if (entity) qb.andWhere('al.entity ILIKE :entity', { entity: `%${entity}%` });
    if (userId) qb.andWhere('al.userId = :userId', { userId });
    if (action) qb.andWhere('al.action = :action', { action });
    if (startDate) qb.andWhere('al.createdAt >= :startDate', { startDate });
    if (endDate) qb.andWhere('al.createdAt <= :endDate', { endDate });

    const total = await qb.getCount();
    const data = await qb
      .orderBy('al.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Audit logs retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
