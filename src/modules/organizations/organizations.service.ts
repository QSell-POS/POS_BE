import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { ShopPlan } from 'src/common/plans/plan.config';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    @InjectRepository(Shop) private shops: Repository<Shop>,
  ) {}

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

  /** Super admin only — upgrade a shop's org plan */
  async upgradePlan(organizationId: string, plan: ShopPlan, planExpiresAt?: Date) {
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');
    org.plan = plan;
    org.planExpiresAt = planExpiresAt ?? null;
    const saved = await this.orgs.save(org);
    return { data: saved, message: `Plan upgraded to ${plan}` };
  }

  async getShops(organizationId: string) {
    const shops = await this.shops.find({ where: { organizationId } });
    return { data: shops, message: 'Shops retrieved successfully' };
  }
}
