import { InjectRepository } from '@nestjs/typeorm';
import { Unit } from './entities/unit.entity';
import { Repository } from 'typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUnitDto, UnitFilterDto, UpdateUnitDto } from './dto/unit.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

@Injectable()
export class UnitsService {
  constructor(@InjectRepository(Unit) private repo: Repository<Unit>) {}

  async findAll(shopId: string, filters: UnitFilterDto) {
    const { search, page = 1, limit = 20 } = filters;
    const qb = this.repo.createQueryBuilder('u').where('u.shopId = :shopId', { shopId });
    if (search) {
      qb.andWhere('(u.name ILIKE :search OR u.symbol ILIKE :search)', { search: `%${search}%` });
    }

    const total = await qb.getCount();
    const data = await qb
      .orderBy('u.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Units fetched',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, shopId: string) {
    const u = await this.repo.findOne({ where: { id, shopId } });
    if (!u) throw new NotFoundException('Unit not found');
    return u;
  }

  create(dto: CreateUnitDto, shopId: string) {
    return this.repo.save(this.repo.create({ ...dto, shopId }));
  }

  async update(id: string, dto: UpdateUnitDto, shopId: string) {
    const u = await this.findOne(id, shopId);
    return this.repo.save(Object.assign(u, dto));
  }

  async remove(id: string, shopId: string) {
    const u = await this.findOne(id, shopId);
    if (!u) throw new NotFoundException('Unit not found');
    await this.repo.softDelete(id);
    return { message: 'Unit deleted' };
  }

  async restore(id: string, shopId: string) {
    const u = await this.repo.findOne({ where: { id, shopId }, withDeleted: true });
    if (!u) throw new NotFoundException('Unit not found');
    await this.repo.restore(id);
    return { message: 'Unit restored' };
  }
}
