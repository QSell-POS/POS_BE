import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { Organization } from 'src/modules/organizations/entities/organization.entity';
import { PLAN_FEATURES, PLAN_UPGRADE_MESSAGE, PlanFeatureKey, ShopPlan } from './plan.config';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Shop) private shops: Repository<Shop>,
    @InjectRepository(Organization) private orgs: Repository<Organization>,
  ) {}

  async getOrgPlan(organizationId: string): Promise<ShopPlan> {
    const org = await this.orgs.findOne({
      where: { id: organizationId },
      select: ['id', 'plan', 'planExpiresAt'],
    });
    if (!org) throw new NotFoundException('Organization not found');

    if (org.planExpiresAt && org.planExpiresAt < new Date() && org.plan !== ShopPlan.FREE) {
      return ShopPlan.FREE;
    }
    return org.plan;
  }

  async getShopPlan(shopId: string): Promise<ShopPlan> {
    const shop = await this.shops.findOne({
      where: { id: shopId },
      select: ['id', 'organizationId'],
    });
    if (!shop) throw new NotFoundException('Shop not found');
    if (!shop.organizationId) return ShopPlan.FREE;
    return this.getOrgPlan(shop.organizationId);
  }

  async assertFeature(shopId: string, feature: PlanFeatureKey): Promise<void> {
    const plan = await this.getShopPlan(shopId);
    const value = PLAN_FEATURES[plan][feature];
    if (value === false) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGE[feature] ?? 'Your plan does not include this feature.');
    }
  }

  async assertQuantity(shopId: string, feature: 'maxStaff' | 'maxProducts', currentCount: number): Promise<void> {
    const plan = await this.getShopPlan(shopId);
    const limit = PLAN_FEATURES[plan][feature] as number;
    if (currentCount >= limit) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGE[feature] ?? 'Plan limit reached.');
    }
  }

  async assertOrgQuantity(organizationId: string, feature: 'maxShops', currentCount: number): Promise<void> {
    const plan = await this.getOrgPlan(organizationId);
    const limit = PLAN_FEATURES[plan][feature] as number;
    if (currentCount >= limit) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGE[feature] ?? 'Plan limit reached.');
    }
  }

  async getPlanInfo(shopId: string) {
    const plan = await this.getShopPlan(shopId);
    return { plan, features: PLAN_FEATURES[plan] };
  }

  async upgradePlan(organizationId: string, plan: ShopPlan, expiresAt?: Date) {
    await this.orgs.update(organizationId, { plan, planExpiresAt: expiresAt ?? null });
    return { plan, features: PLAN_FEATURES[plan] };
  }

  async isFeatureAllowed(feature: PlanFeatureKey, organizationId: string): Promise<boolean> {
    const org = await this.orgs.findOne({
      where: { id: organizationId },
      select: ['id', 'plan', 'planExpiresAt', 'trialEndsAt'],
    });
    if (!org) return false;

    // Check active trial — grants PRO-level access
    if (org.trialEndsAt && org.trialEndsAt > new Date()) {
      const trialFeatures = PLAN_FEATURES[ShopPlan.PRO];
      const val = trialFeatures[feature];
      if (val === true) return true;
    }

    let plan = org.plan;
    if (org.planExpiresAt && org.planExpiresAt < new Date() && plan !== ShopPlan.FREE) {
      plan = ShopPlan.FREE;
    }

    const value = PLAN_FEATURES[plan][feature];
    return value === true;
  }

  async startTrial(organizationId: string): Promise<void> {
    const org = await this.orgs.findOne({ where: { id: organizationId }, select: ['id', 'plan', 'trialEndsAt'] });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.trialEndsAt || org.plan !== ShopPlan.FREE) return; // already used or on paid plan
    const trialDays = PLAN_FEATURES[ShopPlan.FREE].trialDays;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
    await this.orgs.update(organizationId, { trialEndsAt });
  }
}
