import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { Organization } from 'src/modules/organizations/entities/organization.entity';
import { Plan } from './entities/plan.entity';
import { PLAN_FEATURES, PLAN_UPGRADE_MESSAGE, PlanFeatures, PlanFeatureKey, ShopPlan } from './plan.config';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Shop) private shops: Repository<Shop>,
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    @InjectRepository(Plan) private plans: Repository<Plan>,
  ) {}

  // Resolve the effective feature set for a plan key. Reads the DB-managed plan
  // first and maps it onto the legacy PlanFeatures shape used throughout the app;
  // falls back to the hardcoded config if the plan isn't in the DB yet.
  async resolveFeatures(planKey: string): Promise<PlanFeatures> {
    const dbPlan = await this.plans.findOne({ where: { key: planKey, isActive: true } });
    if (dbPlan) {
      const unlimited = (n: number) => (n === -1 ? Infinity : n);
      const flags = dbPlan.featureFlags ?? ({} as Plan['featureFlags']);
      const limits = dbPlan.limits ?? ({} as Plan['limits']);
      return {
        maxStaff: unlimited(limits.maxUsers ?? 0),
        maxProducts: unlimited(limits.maxProducts ?? 0),
        maxShops: unlimited(limits.maxShops ?? 0),
        reports: !!flags.reports,
        bulkImport: !!flags.bulkImport,
        loyalty: !!flags.loyalty,
        stockTransfer: !!flags.stockTransfer,
        apiAccess: !!flags.apiAccess,
        invoiceGen: !!flags.invoiceGen,
        trialDays: dbPlan.trialDays ?? 0,
      };
    }
    return PLAN_FEATURES[planKey as ShopPlan] ?? PLAN_FEATURES[ShopPlan.FREE];
  }

  async getOrgPlan(organizationId: string): Promise<string> {
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

  async getShopPlan(shopId: string): Promise<string> {
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
    const value = (await this.resolveFeatures(plan))[feature];
    if (value === false) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGE[feature] ?? 'Your plan does not include this feature.');
    }
  }

  async assertQuantity(shopId: string, feature: 'maxStaff' | 'maxProducts', currentCount: number): Promise<void> {
    const plan = await this.getShopPlan(shopId);
    const limit = (await this.resolveFeatures(plan))[feature] as number;
    if (currentCount >= limit) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGE[feature] ?? 'Plan limit reached.');
    }
  }

  async assertOrgQuantity(organizationId: string, feature: 'maxShops', currentCount: number): Promise<void> {
    const plan = await this.getOrgPlan(organizationId);
    const limit = (await this.resolveFeatures(plan))[feature] as number;
    if (currentCount >= limit) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGE[feature] ?? 'Plan limit reached.');
    }
  }

  async getPlanInfo(shopId: string) {
    const plan = await this.getShopPlan(shopId);
    return { plan, features: await this.resolveFeatures(plan) };
  }

  async upgradePlan(organizationId: string, plan: string, expiresAt?: Date) {
    await this.orgs.update(organizationId, { plan, planExpiresAt: expiresAt ?? null });
    return { plan, features: await this.resolveFeatures(plan) };
  }

  async isFeatureAllowed(feature: PlanFeatureKey, organizationId: string): Promise<boolean> {
    const org = await this.orgs.findOne({
      where: { id: organizationId },
      select: ['id', 'plan', 'planExpiresAt', 'trialEndsAt'],
    });
    if (!org) return false;

    // Check active trial — grants PRO-level access
    if (org.trialEndsAt && org.trialEndsAt > new Date()) {
      const trialFeatures = await this.resolveFeatures(ShopPlan.PRO);
      if (trialFeatures[feature] === true) return true;
    }

    let plan = org.plan;
    if (org.planExpiresAt && org.planExpiresAt < new Date() && plan !== ShopPlan.FREE) {
      plan = ShopPlan.FREE;
    }

    const value = (await this.resolveFeatures(plan))[feature];
    return value === true;
  }

  async startTrial(organizationId: string): Promise<void> {
    const org = await this.orgs.findOne({ where: { id: organizationId }, select: ['id', 'plan', 'trialEndsAt'] });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.trialEndsAt || org.plan !== ShopPlan.FREE) return; // already used or on paid plan
    const trialDays = (await this.resolveFeatures(ShopPlan.FREE)).trialDays;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
    await this.orgs.update(organizationId, { trialEndsAt });
  }
}
