import { Injectable, ExecutionContext, SetMetadata, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanService } from './plan.service';
import { PLAN_FEATURES, PLAN_UPGRADE_MESSAGE, PlanFeatureKey } from './plan.config';

export const PLAN_FEATURE_KEY = 'planFeature';
export const RequiresPlan = (feature: PlanFeatureKey) => SetMetadata(PLAN_FEATURE_KEY, feature);

@Injectable()
export class PlanGuard {
  constructor(
    private reflector: Reflector,
    private planService: PlanService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeatureKey>(PLAN_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!feature) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.shopId) return false;

    const shop = await this.planService['shops'].findOne({ where: { id: user.shopId }, select: ['id', 'organizationId'] });
    if (!shop?.organizationId) {
      await this.planService.assertFeature(user.shopId, feature);
      return true;
    }

    const allowed = await this.planService.isFeatureAllowed(feature, shop.organizationId);
    if (!allowed) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGE[feature] ?? 'Your plan does not include this feature.');
    }
    return true;
  }
}
