import { ShopPlan } from 'src/common/plans/plan.config';
import { SubscriptionDuration } from './entities/subscription.entity';

/** Pricing in Nepali Rupees (NPR) */
export const SUBSCRIPTION_PRICING: Record<ShopPlan, Record<SubscriptionDuration, number>> = {
  [ShopPlan.FREE]: {
    [SubscriptionDuration.MONTHLY]: 0,
    [SubscriptionDuration.YEARLY]: 0,
  },
  [ShopPlan.PRO]: {
    [SubscriptionDuration.MONTHLY]: 999,
    [SubscriptionDuration.YEARLY]: 9990,
  },
  [ShopPlan.ENTERPRISE]: {
    [SubscriptionDuration.MONTHLY]: 4999,
    [SubscriptionDuration.YEARLY]: 49990,
  },
};

export const DURATION_MONTHS: Record<SubscriptionDuration, number> = {
  [SubscriptionDuration.MONTHLY]: 1,
  [SubscriptionDuration.YEARLY]: 12,
};

export const ESEWA_CONFIG = {
  productCode: process.env.ESEWA_PRODUCT_CODE ?? 'EPAYTEST',
  secretKey: process.env.ESEWA_SECRET_KEY ?? '8gBm/:&EnhH.1/q',
  gatewayUrl:
    process.env.ESEWA_GATEWAY_URL ?? 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
  verifyUrl:
    process.env.ESEWA_VERIFY_URL ??
    'https://uat.esewa.com.np/api/epay/transaction/status/',
  successUrl: process.env.ESEWA_SUCCESS_URL ?? 'http://localhost:3000/subscriptions/esewa/success',
  failureUrl: process.env.ESEWA_FAILURE_URL ?? 'http://localhost:3000/subscriptions/esewa/failure',
};
