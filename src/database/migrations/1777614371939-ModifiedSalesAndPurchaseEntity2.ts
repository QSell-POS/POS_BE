import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixStatusEnums1719999999999 implements MigrationInterface {
  name = 'FixStatusEnums1719999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const purchasesExists = await queryRunner.hasTable('purchases');
    const salesExists = await queryRunner.hasTable('sales');

    if (!purchasesExists || !salesExists) {
      // Fresh database — tables not yet created, nothing to migrate
      return;
    }

    // =========================
    // 1. UPDATE DATA FIRST
    // =========================

    await queryRunner.query(`
      UPDATE purchases
      SET status = 'completed'
      WHERE status IN ('received', 'ordered', 'partial')
    `);

    await queryRunner.query(`
      UPDATE purchases
      SET status = 'cancelled'
      WHERE status = 'draft'
    `);

    await queryRunner.query(`
      UPDATE sales
      SET status = 'completed'
      WHERE status = 'refunded'
    `);

    // =========================
    // 2. REMOVE DEFAULTS (IMPORTANT ⚠️)
    // =========================

    await queryRunner.query(`
      ALTER TABLE purchases ALTER COLUMN status DROP DEFAULT;
    `);

    await queryRunner.query(`
      ALTER TABLE sales ALTER COLUMN status DROP DEFAULT;
    `);

    // =========================
    // 3. FIX PURCHASE ENUM
    // =========================

    const purchasesEnumExists = await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'purchases_status_enum'
    `);

    if (purchasesEnumExists.length > 0) {
      await queryRunner.query(`
        ALTER TYPE purchases_status_enum RENAME TO purchases_status_enum_old;
      `);

      await queryRunner.query(`
        CREATE TYPE purchases_status_enum AS ENUM ('completed', 'cancelled');
      `);

      await queryRunner.query(`
        ALTER TABLE purchases
        ALTER COLUMN status TYPE purchases_status_enum
        USING status::text::purchases_status_enum;
      `);

      await queryRunner.query(`
        DROP TYPE purchases_status_enum_old;
      `);
    }

    // =========================
    // 4. FIX SALES ENUM
    // =========================

    const salesEnumExists = await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'sales_status_enum'
    `);

    if (salesEnumExists.length > 0) {
      await queryRunner.query(`
        ALTER TYPE sales_status_enum RENAME TO sales_status_enum_old;
      `);

      await queryRunner.query(`
        CREATE TYPE sales_status_enum AS ENUM ('completed');
      `);

      await queryRunner.query(`
        ALTER TABLE sales
        ALTER COLUMN status TYPE sales_status_enum
        USING status::text::sales_status_enum;
      `);

      await queryRunner.query(`
        DROP TYPE sales_status_enum_old;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // rollback (basic)

    await queryRunner.query(`
      ALTER TYPE purchases_status_enum RENAME TO purchases_status_enum_new;
    `);

    await queryRunner.query(`
      CREATE TYPE purchases_status_enum AS ENUM ('received', 'ordered', 'draft', 'partial');
    `);

    await queryRunner.query(`
      ALTER TABLE purchases
      ALTER COLUMN status TYPE purchases_status_enum
      USING status::text::purchases_status_enum;
    `);

    await queryRunner.query(`
      DROP TYPE purchases_status_enum_new;
    `);

    await queryRunner.query(`
      ALTER TYPE sales_status_enum RENAME TO sales_status_enum_new;
    `);

    await queryRunner.query(`
      CREATE TYPE sales_status_enum AS ENUM ('refunded');
    `);

    await queryRunner.query(`
      ALTER TABLE sales
      ALTER COLUMN status TYPE sales_status_enum
      USING status::text::sales_status_enum;
    `);

    await queryRunner.query(`
      DROP TYPE sales_status_enum_new;
    `);
  }
}
