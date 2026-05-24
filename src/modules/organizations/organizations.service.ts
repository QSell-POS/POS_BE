import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization, OrgStatus } from './entities/organization.entity';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Plan } from 'src/common/modules/plans/entities/plan.entity';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    @InjectRepository(Shop) private shops: Repository<Shop>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Plan) private plans: Repository<Plan>,
  ) {}

  async findAll(filters: { search?: string; plan?: string; status?: OrgStatus; page?: number; limit?: number }) {
    const { search, plan, status, page = 1, limit = 20 } = filters;

    const qb = this.orgs.createQueryBuilder('o');
    if (search) qb.andWhere('(o.name ILIKE :s OR o.email ILIKE :s)', { s: `%${search}%` });
    if (plan)   qb.andWhere('o.plan = :plan', { plan });
    if (status) qb.andWhere('o.status = :status', { status });

    const total = await qb.getCount();
    const orgs  = await qb.orderBy('o.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getMany();

    if (!orgs.length) return { data: [], message: 'Organizations fetched successfully', meta: buildPaginationMeta(total, page, limit) };

    const ownerIds = [...new Set(orgs.map(o => o.ownerId).filter(Boolean))];
    const orgIds   = orgs.map(o => o.id);

    const [owners, shopCounts] = await Promise.all([
      ownerIds.length ? this.users.find({ where: ownerIds.map(id => ({ id })), select: ['id', 'firstName', 'lastName', 'email'] }) : [],
      this.shops.createQueryBuilder('s')
        .select('s.organizationId', 'orgId')
        .addSelect('COUNT(s.id)', 'count')
        .where('s.organizationId IN (:...orgIds)', { orgIds })
        .groupBy('s.organizationId')
        .getRawMany(),
    ]);

    const ownerMap     = Object.fromEntries(owners.map(u => [u.id, u]));
    const shopCountMap = Object.fromEntries(shopCounts.map(r => [r.orgId, Number(r.count)]));

    const data = orgs.map(o => ({
      ...o,
      ownerName:  ownerMap[o.ownerId] ? `${ownerMap[o.ownerId].firstName} ${ownerMap[o.ownerId].lastName}`.trim() : null,
      ownerEmail: ownerMap[o.ownerId]?.email ?? null,
      shopCount:  shopCountMap[o.id] ?? 0,
    }));

    return { data, message: 'Organizations fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const org = await this.orgs.findOne({ where: { id }, relations: ['shops'] });
    if (!org) throw new NotFoundException('Organization not found');
    const owner = org.ownerId ? await this.users.findOne({ where: { id: org.ownerId }, select: ['id', 'firstName', 'lastName', 'email'] }) : null;
    const shopCount = await this.shops.count({ where: { organizationId: id } });
    return {
      data: {
        ...org,
        ownerName:  owner ? `${owner.firstName} ${owner.lastName}`.trim() : null,
        ownerEmail: owner?.email ?? null,
        shopCount,
      },
      message: 'Organization retrieved successfully',
    };
  }

  async updateStatus(id: string, status: OrgStatus) {
    const org = await this.orgs.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    org.status = status;
    const saved = await this.orgs.save(org);
    return { data: saved, message: `Organization ${status}` };
  }

  async findMyOrg(organizationId: string) {
    const org = await this.orgs.findOne({
      where: { id: organizationId },
      relations: ['shops'],
    });
    if (!org) throw new NotFoundException('Organization not found');
    return { data: org, message: 'Organization retrieved successfully' };
  }

  async update(organizationId: string, dto: Partial<Pick<Organization, 'name' | 'logo' | 'address' | 'email' | 'phone'>>, requesterId: string) {
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.ownerId !== requesterId) throw new ForbiddenException('Only the organization owner can update it');
    Object.assign(org, dto);
    const saved = await this.orgs.save(org);
    return { data: saved, message: 'Organization updated successfully' };
  }

  /** Super admin only — assign/upgrade a shop's org plan (any plan key from the plans table) */
  async upgradePlan(organizationId: string, plan: string, planExpiresAt?: Date) {
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const target = await this.plans.findOne({ where: { key: plan } });
    if (!target) throw new BadRequestException(`Unknown plan "${plan}"`);
    if (!target.isActive) throw new BadRequestException(`Plan "${plan}" is inactive`);

    org.plan = target.key;
    org.planExpiresAt = planExpiresAt ?? null;
    const saved = await this.orgs.save(org);
    return { data: saved, message: `Plan changed to ${target.name}` };
  }

  async getShops(organizationId: string) {
    const shops = await this.shops.find({ where: { organizationId } });
    return { data: shops, message: 'Shops retrieved successfully' };
  }
}
