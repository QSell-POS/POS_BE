import { UserRole } from 'src/modules/users/entities/user.entity';

export enum Permission {
  // ── Products ─────────────────────────────────────────────
  PRODUCTS_VIEW        = 'products:view',
  PRODUCTS_CREATE      = 'products:create',
  PRODUCTS_UPDATE      = 'products:update',
  PRODUCTS_DELETE      = 'products:delete',
  PRODUCTS_IMPORT      = 'products:import',
  PRODUCTS_EXPORT      = 'products:export',

  // ── Variants ─────────────────────────────────────────────
  VARIANTS_VIEW        = 'variants:view',
  VARIANTS_MANAGE      = 'variants:manage',

  // ── Sales ────────────────────────────────────────────────
  SALES_VIEW           = 'sales:view',
  SALES_CREATE         = 'sales:create',
  SALES_RETURN         = 'sales:return',
  SALES_VOID           = 'sales:void',
  SALES_EXPORT         = 'sales:export',

  // ── Purchases ────────────────────────────────────────────
  PURCHASES_VIEW       = 'purchases:view',
  PURCHASES_CREATE     = 'purchases:create',
  PURCHASES_RECEIVE    = 'purchases:receive',
  PURCHASES_RETURN     = 'purchases:return',
  PURCHASES_EXPORT     = 'purchases:export',

  // ── Inventory ────────────────────────────────────────────
  INVENTORY_VIEW       = 'inventory:view',
  INVENTORY_ADJUST     = 'inventory:adjust',
  INVENTORY_TRANSFER   = 'inventory:transfer',
  INVENTORY_EXPORT     = 'inventory:export',

  // ── Customers ────────────────────────────────────────────
  CUSTOMERS_VIEW       = 'customers:view',
  CUSTOMERS_CREATE     = 'customers:create',
  CUSTOMERS_UPDATE     = 'customers:update',
  CUSTOMERS_DELETE     = 'customers:delete',
  CUSTOMERS_LEDGER     = 'customers:ledger',
  CUSTOMERS_PAYMENTS   = 'customers:payments',

  // ── Suppliers ────────────────────────────────────────────
  SUPPLIERS_VIEW       = 'suppliers:view',
  SUPPLIERS_CREATE     = 'suppliers:create',
  SUPPLIERS_UPDATE     = 'suppliers:update',
  SUPPLIERS_DELETE     = 'suppliers:delete',
  SUPPLIERS_LEDGER     = 'suppliers:ledger',
  SUPPLIERS_PAYMENTS   = 'suppliers:payments',

  // ── Expenses ─────────────────────────────────────────────
  EXPENSES_VIEW        = 'expenses:view',
  EXPENSES_CREATE      = 'expenses:create',
  EXPENSES_DELETE      = 'expenses:delete',

  // ── Reports ──────────────────────────────────────────────
  REPORTS_VIEW         = 'reports:view',
  REPORTS_EXPORT       = 'reports:export',

  // ── Analytics ────────────────────────────────────────────
  ANALYTICS_VIEW       = 'analytics:view',

  // ── Discounts ────────────────────────────────────────────
  DISCOUNTS_VIEW       = 'discounts:view',
  DISCOUNTS_MANAGE     = 'discounts:manage',

  // ── Tax ──────────────────────────────────────────────────
  TAX_VIEW             = 'tax:view',
  TAX_MANAGE           = 'tax:manage',

  // ── Loyalty ──────────────────────────────────────────────
  LOYALTY_VIEW         = 'loyalty:view',
  LOYALTY_MANAGE       = 'loyalty:manage',

  // ── Shifts ───────────────────────────────────────────────
  SHIFTS_VIEW          = 'shifts:view',
  SHIFTS_MANAGE        = 'shifts:manage',

  // ── Staff ────────────────────────────────────────────────
  STAFF_VIEW           = 'staff:view',
  STAFF_CREATE         = 'staff:create',
  STAFF_UPDATE         = 'staff:update',
  STAFF_DELETE         = 'staff:delete',
  STAFF_PERMISSIONS    = 'staff:permissions',

  // ── Settings (brands, categories, units) ─────────────────
  SETTINGS_VIEW        = 'settings:view',
  SETTINGS_MANAGE      = 'settings:manage',

  // ── Audit Log ────────────────────────────────────────────
  AUDIT_VIEW           = 'audit:view',
}

// ── Default permissions per role ──────────────────────────────────────────────

export const DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.CASHIER]: [
    Permission.PRODUCTS_VIEW,
    Permission.VARIANTS_VIEW,
    Permission.SALES_VIEW,
    Permission.SALES_CREATE,
    Permission.CUSTOMERS_VIEW,
    Permission.CUSTOMERS_CREATE,
    Permission.DISCOUNTS_VIEW,
    Permission.SHIFTS_VIEW,
  ],

  [UserRole.VIEWER]: [
    Permission.PRODUCTS_VIEW,
    Permission.VARIANTS_VIEW,
    Permission.SALES_VIEW,
    Permission.PURCHASES_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.CUSTOMERS_VIEW,
    Permission.SUPPLIERS_VIEW,
    Permission.EXPENSES_VIEW,
    Permission.REPORTS_VIEW,
    Permission.ANALYTICS_VIEW,
    Permission.DISCOUNTS_VIEW,
    Permission.TAX_VIEW,
    Permission.SHIFTS_VIEW,
    Permission.SETTINGS_VIEW,
  ],

  [UserRole.MANAGER]: [
    // Products
    Permission.PRODUCTS_VIEW,
    Permission.PRODUCTS_CREATE,
    Permission.PRODUCTS_UPDATE,
    Permission.PRODUCTS_EXPORT,
    Permission.VARIANTS_VIEW,
    Permission.VARIANTS_MANAGE,
    // Sales
    Permission.SALES_VIEW,
    Permission.SALES_CREATE,
    Permission.SALES_RETURN,
    Permission.SALES_VOID,
    Permission.SALES_EXPORT,
    // Purchases
    Permission.PURCHASES_VIEW,
    Permission.PURCHASES_CREATE,
    Permission.PURCHASES_RECEIVE,
    Permission.PURCHASES_RETURN,
    Permission.PURCHASES_EXPORT,
    // Inventory
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_ADJUST,
    Permission.INVENTORY_TRANSFER,
    Permission.INVENTORY_EXPORT,
    // Customers
    Permission.CUSTOMERS_VIEW,
    Permission.CUSTOMERS_CREATE,
    Permission.CUSTOMERS_UPDATE,
    Permission.CUSTOMERS_LEDGER,
    Permission.CUSTOMERS_PAYMENTS,
    // Suppliers
    Permission.SUPPLIERS_VIEW,
    Permission.SUPPLIERS_CREATE,
    Permission.SUPPLIERS_UPDATE,
    Permission.SUPPLIERS_LEDGER,
    Permission.SUPPLIERS_PAYMENTS,
    // Expenses
    Permission.EXPENSES_VIEW,
    Permission.EXPENSES_CREATE,
    // Reports & Analytics
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,
    Permission.ANALYTICS_VIEW,
    // Other
    Permission.DISCOUNTS_VIEW,
    Permission.DISCOUNTS_MANAGE,
    Permission.TAX_VIEW,
    Permission.LOYALTY_VIEW,
    Permission.LOYALTY_MANAGE,
    Permission.SHIFTS_VIEW,
    Permission.SHIFTS_MANAGE,
    Permission.STAFF_VIEW,
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_MANAGE,
  ],

  // Admin and Super Admin bypass all permission checks — array unused
  [UserRole.ADMIN]: [],
  [UserRole.SUPER_ADMIN]: [],
};

// ── Metadata for frontend permission editor UI ────────────────────────────────

export const PERMISSION_META: Record<Permission, { label: string; group: string }> = {
  // Products
  [Permission.PRODUCTS_VIEW]:       { label: 'View Products',         group: 'Products' },
  [Permission.PRODUCTS_CREATE]:     { label: 'Create Products',       group: 'Products' },
  [Permission.PRODUCTS_UPDATE]:     { label: 'Update Products',       group: 'Products' },
  [Permission.PRODUCTS_DELETE]:     { label: 'Delete Products',       group: 'Products' },
  [Permission.PRODUCTS_IMPORT]:     { label: 'Bulk Import Products',  group: 'Products' },
  [Permission.PRODUCTS_EXPORT]:     { label: 'Export Products',       group: 'Products' },
  // Variants
  [Permission.VARIANTS_VIEW]:       { label: 'View Variants',         group: 'Variants' },
  [Permission.VARIANTS_MANAGE]:     { label: 'Manage Variants',       group: 'Variants' },
  // Sales
  [Permission.SALES_VIEW]:          { label: 'View Sales',            group: 'Sales' },
  [Permission.SALES_CREATE]:        { label: 'Create Sales',          group: 'Sales' },
  [Permission.SALES_RETURN]:        { label: 'Process Returns',       group: 'Sales' },
  [Permission.SALES_VOID]:          { label: 'Void Sales',            group: 'Sales' },
  [Permission.SALES_EXPORT]:        { label: 'Export Sales',          group: 'Sales' },
  // Purchases
  [Permission.PURCHASES_VIEW]:      { label: 'View Purchases',        group: 'Purchases' },
  [Permission.PURCHASES_CREATE]:    { label: 'Create Purchases',      group: 'Purchases' },
  [Permission.PURCHASES_RECEIVE]:   { label: 'Receive Purchases',     group: 'Purchases' },
  [Permission.PURCHASES_RETURN]:    { label: 'Return Purchases',      group: 'Purchases' },
  [Permission.PURCHASES_EXPORT]:    { label: 'Export Purchases',      group: 'Purchases' },
  // Inventory
  [Permission.INVENTORY_VIEW]:      { label: 'View Inventory',        group: 'Inventory' },
  [Permission.INVENTORY_ADJUST]:    { label: 'Adjust Stock',          group: 'Inventory' },
  [Permission.INVENTORY_TRANSFER]:  { label: 'Transfer Stock',        group: 'Inventory' },
  [Permission.INVENTORY_EXPORT]:    { label: 'Export Inventory',      group: 'Inventory' },
  // Customers
  [Permission.CUSTOMERS_VIEW]:      { label: 'View Customers',        group: 'Customers' },
  [Permission.CUSTOMERS_CREATE]:    { label: 'Create Customers',      group: 'Customers' },
  [Permission.CUSTOMERS_UPDATE]:    { label: 'Update Customers',      group: 'Customers' },
  [Permission.CUSTOMERS_DELETE]:    { label: 'Delete Customers',      group: 'Customers' },
  [Permission.CUSTOMERS_LEDGER]:    { label: 'View Customer Ledger',  group: 'Customers' },
  [Permission.CUSTOMERS_PAYMENTS]:  { label: 'Record Payments',       group: 'Customers' },
  // Suppliers
  [Permission.SUPPLIERS_VIEW]:      { label: 'View Suppliers',        group: 'Suppliers' },
  [Permission.SUPPLIERS_CREATE]:    { label: 'Create Suppliers',      group: 'Suppliers' },
  [Permission.SUPPLIERS_UPDATE]:    { label: 'Update Suppliers',      group: 'Suppliers' },
  [Permission.SUPPLIERS_DELETE]:    { label: 'Delete Suppliers',      group: 'Suppliers' },
  [Permission.SUPPLIERS_LEDGER]:    { label: 'View Supplier Ledger',  group: 'Suppliers' },
  [Permission.SUPPLIERS_PAYMENTS]:  { label: 'Record Payments',       group: 'Suppliers' },
  // Expenses
  [Permission.EXPENSES_VIEW]:       { label: 'View Expenses',         group: 'Expenses' },
  [Permission.EXPENSES_CREATE]:     { label: 'Create Expenses',       group: 'Expenses' },
  [Permission.EXPENSES_DELETE]:     { label: 'Delete Expenses',       group: 'Expenses' },
  // Reports
  [Permission.REPORTS_VIEW]:        { label: 'View Reports',          group: 'Reports' },
  [Permission.REPORTS_EXPORT]:      { label: 'Export Reports',        group: 'Reports' },
  // Analytics
  [Permission.ANALYTICS_VIEW]:      { label: 'View Analytics',        group: 'Analytics' },
  // Discounts
  [Permission.DISCOUNTS_VIEW]:      { label: 'View Discounts',        group: 'Discounts' },
  [Permission.DISCOUNTS_MANAGE]:    { label: 'Manage Discounts',      group: 'Discounts' },
  // Tax
  [Permission.TAX_VIEW]:            { label: 'View Tax Rules',        group: 'Tax' },
  [Permission.TAX_MANAGE]:          { label: 'Manage Tax Rules',      group: 'Tax' },
  // Loyalty
  [Permission.LOYALTY_VIEW]:        { label: 'View Loyalty',          group: 'Loyalty' },
  [Permission.LOYALTY_MANAGE]:      { label: 'Manage Loyalty',        group: 'Loyalty' },
  // Shifts
  [Permission.SHIFTS_VIEW]:         { label: 'View Shifts',           group: 'Shifts' },
  [Permission.SHIFTS_MANAGE]:       { label: 'Manage Shifts',         group: 'Shifts' },
  // Staff
  [Permission.STAFF_VIEW]:          { label: 'View Staff',            group: 'Staff' },
  [Permission.STAFF_CREATE]:        { label: 'Create Staff',          group: 'Staff' },
  [Permission.STAFF_UPDATE]:        { label: 'Update Staff',          group: 'Staff' },
  [Permission.STAFF_DELETE]:        { label: 'Delete Staff',          group: 'Staff' },
  [Permission.STAFF_PERMISSIONS]:   { label: 'Edit Permissions',      group: 'Staff' },
  // Settings
  [Permission.SETTINGS_VIEW]:       { label: 'View Settings',         group: 'Settings' },
  [Permission.SETTINGS_MANAGE]:     { label: 'Manage Settings',       group: 'Settings' },
  // Audit
  [Permission.AUDIT_VIEW]:          { label: 'View Audit Log',        group: 'Audit' },
};
