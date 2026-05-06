import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveFieldsFromProductToVariant1777700000000 implements MigrationInterface {
  name = 'MoveFieldsFromProductToVariant1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to product_variants
    await queryRunner.query(`
      ALTER TABLE "product_variants"
        ADD COLUMN IF NOT EXISTS "image" varchar(255),
        ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "min_stock_level" decimal(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "max_stock_level" decimal(10,2),
        ADD COLUMN IF NOT EXISTS "reorder_point" decimal(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "track_inventory" boolean NOT NULL DEFAULT true
    `);

    // Add unique index on barcode for product_variants
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variants_shop_barcode"
        ON "product_variants" ("shop_id", "barcode")
        WHERE "barcode" IS NOT NULL AND "deleted_at" IS NULL
    `);

    // Migrate data: copy fields from products to the default variant
    await queryRunner.query(`
      UPDATE product_variants pv
      SET
        image = p.image,
        status = p.status,
        min_stock_level = p.min_stock_level,
        max_stock_level = p.max_stock_level,
        reorder_point = p.reorder_point,
        track_inventory = p.track_inventory
      FROM products p
      WHERE pv.product_id = p.id
        AND pv.is_default = true
    `);

    // Also copy sku/barcode from products to default variants where variant sku/barcode is null
    await queryRunner.query(`
      UPDATE product_variants pv
      SET
        sku = COALESCE(pv.sku, p.sku),
        barcode = COALESCE(pv.barcode, p.barcode)
      FROM products p
      WHERE pv.product_id = p.id
        AND pv.is_default = true
    `);

    // Drop indexes on products that reference removed columns
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_barcode"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_sku"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_shop_status"`);

    // Remove columns from products
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN IF EXISTS "sku",
        DROP COLUMN IF EXISTS "barcode",
        DROP COLUMN IF EXISTS "image",
        DROP COLUMN IF EXISTS "status",
        DROP COLUMN IF EXISTS "min_stock_level",
        DROP COLUMN IF EXISTS "max_stock_level",
        DROP COLUMN IF EXISTS "reorder_point",
        DROP COLUMN IF EXISTS "track_inventory"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add columns to products
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "sku" varchar(100),
        ADD COLUMN IF NOT EXISTS "barcode" varchar(100),
        ADD COLUMN IF NOT EXISTS "image" varchar(255),
        ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "min_stock_level" decimal(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "max_stock_level" decimal(10,2),
        ADD COLUMN IF NOT EXISTS "reorder_point" decimal(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "track_inventory" boolean NOT NULL DEFAULT true
    `);

    // Restore data from default variants back to products
    await queryRunner.query(`
      UPDATE products p
      SET
        sku = pv.sku,
        barcode = pv.barcode,
        image = pv.image,
        status = pv.status,
        min_stock_level = pv.min_stock_level,
        max_stock_level = pv.max_stock_level,
        reorder_point = pv.reorder_point,
        track_inventory = pv.track_inventory
      FROM product_variants pv
      WHERE pv.product_id = p.id
        AND pv.is_default = true
    `);

    // Remove added columns from product_variants
    await queryRunner.query(`
      ALTER TABLE "product_variants"
        DROP COLUMN IF EXISTS "image",
        DROP COLUMN IF EXISTS "status",
        DROP COLUMN IF EXISTS "min_stock_level",
        DROP COLUMN IF EXISTS "max_stock_level",
        DROP COLUMN IF EXISTS "reorder_point",
        DROP COLUMN IF EXISTS "track_inventory"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_variants_shop_barcode"`);
  }
}
