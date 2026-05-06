export interface ProductImportRow {
  name: string;
  description?: string;
  type?: string;
  sku?: string;
  barcode?: string;
  status?: string;
  retailPrice: number;
  purchasePrice?: number;
  wholesalePrice?: number;
  taxRate?: number;
  categoryId?: string;
  brandId?: string;
  unitId?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  trackInventory?: string | boolean;
  initialQuantity?: number;
}

export interface VariantImportRow {
  /** Must match the SKU of a product in the Products sheet (or an existing product's default variant SKU) */
  productSku: string;
  name: string;
  sku?: string;
  barcode?: string;
  status?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  trackInventory?: string | boolean;
  /** JSON string e.g. {"color":"Red","size":"M"} */
  attributes?: string;
  initialQuantity?: number;
}

export interface ImportRowError {
  sheet: 'Products' | 'Variants';
  row: number;
  error: string;
}

export interface BulkImportResult {
  imported: number;
  skipped: number;
  errors: ImportRowError[];
}
