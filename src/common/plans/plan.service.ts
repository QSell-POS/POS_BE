import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { PLAN_FEATURES, PLAN_UPGRADE_MESSAGE, PlanFeatureKey, ShopPlan } from './plan.config';

@Injectable()
export class PlanService {
  constructor(@InjectRepository(Shop) private shops: Repository<Shop>) {}

  async getShopPlan(shopId: string): Promise<ShopPlan> {
    const shop = await this.shops.findOne({ where: { id: shopId }, select: ['id', 'plan', 'planExpiresAt'] });
    if (!shop) throw new NotFoundException('Shop not found');

    // Treat expired plans as FREE
    if (shop.planExpiresAt && shop.planExpiresAt < new Date() && shop.plan !== ShopPlan.FREE) {
      return ShopPlan.FREE;
    }
    return shop.plan;
  }

  async assertFeature(shopId: string, feature: PlanFeatureKey): Promise<void> {
    const plan = await this.getShopPlan(shopId);
    const features = PLAN_FEATURES[plan];
    const value = features[feature];

    if (value === false) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGE[feature] ?? `Your plan does not include this feature.`);
    }
  }

  async assertQuantity(shopId: string, feature: 'maxStaff' | 'maxProducts', currentCount: number): Promise<void> {
    const plan = await this.getShopPlan(shopId);
    const limit = PLAN_FEATURES[plan][feature] as number;

    if (currentCount >= limit) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGE[feature] ?? `Plan limit reached.`);
    }
  }

  async getPlanInfo(shopId: string) {
    const plan = await this.getShopPlan(shopId);
    return { plan, features: PLAN_FEATURES[plan] };
  }
}
