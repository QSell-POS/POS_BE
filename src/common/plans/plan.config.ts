export enum ShopPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export interface PlanFeatures {
  maxStaff: number;
  maxProducts: number;
  reports: boolean;
  bulkImport: boolean;
  loyalty: boolean;
  stockTransfer: boolean;
  apiAccess: boolean;
}

export const PLAN_FEATURES: Record<ShopPlan, PlanFeatures> = {
  [ShopPlan.FREE]: {
    maxStaff: 2,
    maxProducts: 100,
    reports: false,
    bulkImport: false,
    loyalty: false,
    stockTransfer: false,
    apiAccess: false,
  },
  [ShopPlan.PRO]: {
    maxStaff: 15,
    maxProducts: 5000,
    reports: true,
    bulkImport: true,
    loyalty: true,
    stockTransfer: true,
    apiAccess: false,
  },
  [ShopPlan.ENTERPRISE]: {
    maxStaff: Infinity,
    maxProducts: Infinity,
    reports: true,
    bulkImport: true,
    loyalty: true,
    stockTransfer: true,
    apiAccess: true,
  },
};

export type PlanFeatureKey = keyof PlanFeatures;

/** Human-readable upgrade messages per feature */
export const PLAN_UPGRADE_MESSAGE: Partial<Record<PlanFeatureKey, string>> = {
  reports: 'Upgrade to Pro to access Reports.',
  bulkImport: 'Upgrade to Pro to use Bulk Import.',
  loyalty: 'Upgrade to Pro to use the Loyalty module.',
  stockTransfer: 'Upgrade to Pro to use Stock Transfers.',
  apiAccess: 'Upgrade to Enterprise to access the API.',
  maxStaff: 'You have reached your plan\'s staff limit. Upgrade to add more.',
  maxProducts: 'You have reached your plan\'s product limit. Upgrade to add more.',
};
