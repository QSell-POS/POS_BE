export enum ShopPlan {
  FREE       = 'free',
  PRO        = 'pro',
  ENTERPRISE = 'enterprise',
  CUSTOM     = 'custom',
}

export interface PlanFeatures {
  maxStaff:       number;
  maxProducts:    number;
  maxShops:       number;
  reports:        boolean;
  bulkImport:     boolean;
  loyalty:        boolean;
  stockTransfer:  boolean;
  apiAccess:      boolean;
  invoiceGen:     boolean;
  trialDays:      number;
}

export const PLAN_FEATURES: Record<ShopPlan, PlanFeatures> = {
  [ShopPlan.FREE]: {
    maxStaff:      2,
    maxProducts:   100,
    maxShops:      1,
    reports:       false,
    bulkImport:    false,
    loyalty:       false,
    stockTransfer: false,
    apiAccess:     false,
    invoiceGen:    false,
    trialDays:     14,
  },
  [ShopPlan.PRO]: {
    maxStaff:      15,
    maxProducts:   5000,
    maxShops:      5,
    reports:       true,
    bulkImport:    true,
    loyalty:       true,
    stockTransfer: true,
    apiAccess:     false,
    invoiceGen:    true,
    trialDays:     0,
  },
  [ShopPlan.ENTERPRISE]: {
    maxStaff:      Infinity,
    maxProducts:   Infinity,
    maxShops:      Infinity,
    reports:       true,
    bulkImport:    true,
    loyalty:       true,
    stockTransfer: true,
    apiAccess:     true,
    invoiceGen:    true,
    trialDays:     0,
  },
  [ShopPlan.CUSTOM]: {
    maxStaff:      Infinity,
    maxProducts:   Infinity,
    maxShops:      Infinity,
    reports:       true,
    bulkImport:    true,
    loyalty:       true,
    stockTransfer: true,
    apiAccess:     true,
    invoiceGen:    true,
    trialDays:     0,
  },
};

export type PlanFeatureKey = keyof PlanFeatures;

export const PLAN_UPGRADE_MESSAGE: Partial<Record<PlanFeatureKey, string>> = {
  reports:       'Upgrade to Pro to access Reports.',
  bulkImport:    'Upgrade to Pro to use Bulk Import.',
  loyalty:       'Upgrade to Pro to use the Loyalty module.',
  stockTransfer: 'Upgrade to Pro to use Stock Transfers.',
  apiAccess:     'Upgrade to Enterprise to access the API.',
  invoiceGen:    'Upgrade to Pro to generate PDF invoices.',
  maxStaff:      "You have reached your plan's staff limit. Upgrade to add more.",
  maxProducts:   "You have reached your plan's product limit. Upgrade to add more.",
  maxShops:      "You have reached your plan's shop limit. Upgrade to add more shops.",
};
