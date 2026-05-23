import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Plan, PlanFeatureFlags } from './entities/plan.entity';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

const DEFAULT_FLAGS: PlanFeatureFlags = {
  reports: false,
  bulkImport: false,
  loyalty: false,
  stockTransfer: false,
  apiAccess: false,
  invoiceGen: false,
};

@Injectable()
export class PlanAdminService {
  constructor(
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
  ) {}

  findAll() {
    return this.plans.find({ order: { sortOrder: 'ASC', monthlyPrice: 'ASC' } });
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    const exists = await this.plans.findOne({ where: { key: dto.key } });
    if (exists) throw new ConflictException(`A plan with key "${dto.key}" already exists`);

    const plan = this.plans.create({
      ...dto,
      annualPrice: dto.annualPrice ?? null,
      featureFlags: { ...DEFAULT_FLAGS, ...(dto.featureFlags ?? {}) },
      features: dto.features ?? [],
    });
    const saved = await this.plans.save(plan);
    if (saved.isPopular) await this.clearOtherPopular(saved.id);
    return saved;
  }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findOne(id);

    if (dto.key && dto.key !== plan.key) {
      const clash = await this.plans.findOne({ where: { key: dto.key } });
      if (clash) throw new ConflictException(`A plan with key "${dto.key}" already exists`);
    }

    if (dto.featureFlags) {
      dto.featureFlags = { ...plan.featureFlags, ...dto.featureFlags };
    }
    if (dto.annualPrice === undefined) delete (dto as any).annualPrice;

    Object.assign(plan, dto);
    const saved = await this.plans.save(plan);
    if (saved.isPopular) await this.clearOtherPopular(saved.id);
    return saved;
  }

  async remove(id: string): Promise<{ message: string }> {
    const plan = await this.findOne(id);
    await this.plans.softRemove(plan);
    return { message: 'Plan deleted' };
  }

  private async clearOtherPopular(keepId: string): Promise<void> {
    await this.plans.update({ id: Not(keepId), isPopular: true }, { isPopular: false });
  }
}
