export enum Permission {
  // Products
  PRODUCTS_VIEW = 'products:view',
  PRODUCTS_MANAGE = 'products:manage',

  // Sales
  SALES_VIEW = 'sales:view',
  SALES_CREATE = 'sales:create',
  SALES_VOID = 'sales:void',

  // Inventory
  INVENTORY_VIEW = 'inventory:view',
  INVENTORY_ADJUST = 'inventory:adjust',

  // Reports
  REPORTS_VIEW = 'reports:view',

  // Customers
  CUSTOMERS_VIEW = 'customers:view',
  CUSTOMERS_MANAGE = 'customers:manage',

  // Purchases
  PURCHASES_VIEW = 'purchases:view',
  PURCHASES_CREATE = 'purchases:create',

  // Staff
  STAFF_VIEW = 'staff:view',
  STAFF_MANAGE = 'staff:manage',
}

/** Preset role templates shown to the owner when creating a staff member */
export enum StaffPreset {
  CASHIER = 'cashier',
  INVENTORY_CLERK = 'inventory_clerk',
  MANAGER = 'manager',
  CUSTOM = 'custom',
}

/** Default permission set for each preset — owner can customise after creation */
export const PRESET_PERMISSIONS: Record<StaffPreset, Permission[]> = {
  [StaffPreset.CASHIER]: [
    Permission.PRODUCTS_VIEW,
    Permission.SALES_VIEW,
    Permission.SALES_CREATE,
    Permission.CUSTOMERS_VIEW,
  ],

  [StaffPreset.INVENTORY_CLERK]: [
    Permission.PRODUCTS_VIEW,
    Permission.PRODUCTS_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_ADJUST,
    Permission.PURCHASES_VIEW,
  ],

  [StaffPreset.MANAGER]: [
    Permission.PRODUCTS_VIEW,
    Permission.PRODUCTS_MANAGE,
    Permission.SALES_VIEW,
    Permission.SALES_CREATE,
    Permission.SALES_VOID,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_ADJUST,
    Permission.REPORTS_VIEW,
    Permission.CUSTOMERS_VIEW,
    Permission.CUSTOMERS_MANAGE,
    Permission.PURCHASES_VIEW,
    Permission.PURCHASES_CREATE,
    Permission.STAFF_VIEW,
  ],

  [StaffPreset.CUSTOM]: [],
};

/** Human-readable descriptions for each permission (useful for the frontend) */
export const PERMISSION_META: Record<Permission, { label: string; group: string }> = {
  [Permission.PRODUCTS_VIEW]:    { label: 'View Products',       group: 'Products' },
  [Permission.PRODUCTS_MANAGE]:  { label: 'Manage Products',     group: 'Products' },
  [Permission.SALES_VIEW]:       { label: 'View Sales',          group: 'Sales' },
  [Permission.SALES_CREATE]:     { label: 'Create Sales',        group: 'Sales' },
  [Permission.SALES_VOID]:       { label: 'Void Sales',          group: 'Sales' },
  [Permission.INVENTORY_VIEW]:   { label: 'View Inventory',      group: 'Inventory' },
  [Permission.INVENTORY_ADJUST]: { label: 'Adjust Inventory',    group: 'Inventory' },
  [Permission.REPORTS_VIEW]:     { label: 'View Reports',        group: 'Reports' },
  [Permission.CUSTOMERS_VIEW]:   { label: 'View Customers',      group: 'Customers' },
  [Permission.CUSTOMERS_MANAGE]: { label: 'Manage Customers',    group: 'Customers' },
  [Permission.PURCHASES_VIEW]:   { label: 'View Purchases',      group: 'Purchases' },
  [Permission.PURCHASES_CREATE]: { label: 'Create Purchases',    group: 'Purchases' },
  [Permission.STAFF_VIEW]:       { label: 'View Staff',          group: 'Staff' },
  [Permission.STAFF_MANAGE]:     { label: 'Manage Staff',        group: 'Staff' },
};
