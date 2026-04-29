import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { TaxRule } from './entities/tax-rule.entity';
import { CreateTaxRuleDto, TaxFilterDto, UpdateTaxRuleDto } from './dto/tax.dto';

@Injectable()
export class TaxService {
  constructor(
    @InjectRepository(TaxRule)
    private readonly repo: Repository<TaxRule>,
  ) {}

  async create(dto: CreateTaxRuleDto, shopId: string) {
    const taxRule = this.repo.create({ ...dto, shopId });
    const saved = await this.repo.save(taxRule);
    return { data: saved, message: 'Tax rule created successfully' };
  }

  async findAll(shopId: string, filters: TaxFilterDto) {
    const { search, isActive, code, page = 1, limit = 20 } = filters;

    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.shopId = :shopId', { shopId });

    if (search) {
      qb.andWhere('(t.name ILIKE :search OR t.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (isActive !== undefined) qb.andWhere('t.isActive = :isActive', { isActive });
    if (code) qb.andWhere('t.code = :code', { code });

    const total = await qb.getCount();
    const data = await qb
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Tax rules retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, shopId: string) {
    const taxRule = await this.repo.findOne({ where: { id, shopId } });
    if (!taxRule) throw new NotFoundException('Tax rule not found');
    return { data: taxRule, message: 'Tax rule retrieved successfully' };
  }

  async update(id: string, dto: UpdateTaxRuleDto, shopId: string) {
    const { data: taxRule } = await this.findOne(id, shopId);
    Object.assign(taxRule, dto);
    const saved = await this.repo.save(taxRule);
    return { data: saved, message: 'Tax rule updated successfully' };
  }

  async remove(id: string, shopId: string) {
    await this.findOne(id, shopId);
    await this.repo.softDelete(id);
    return { message: 'Tax rule deleted successfully' };
  }

  async setDefault(id: string, shopId: string) {
    // Verify the tax rule exists for this shop
    await this.findOne(id, shopId);
    // Unset existing default for this shop
    await this.repo.update({ shopId, isDefault: true }, { isDefault: false });
    // Set new default
    await this.repo.update(id, { isDefault: true });
    return { message: 'Default tax rule updated' };
  }

  async getDefault(shopId: string) {
    const rule = await this.repo.findOne({
      where: { shopId, isDefault: true, isActive: true },
    });
    return { data: rule, message: 'Default tax rule' };
  }
}
