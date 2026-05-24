import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterOrganizationPlanToVarchar1748044800000 implements MigrationInterface {
  name = 'AlterOrganizationPlanToVarchar1748044800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert organizations.plan from the fixed enum to a free-form varchar(50)
    // so super admins can assign any plan key created via the /plans API.
    // Guarded so it's a no-op if the column is already varchar (e.g. created via synchronize).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'organizations'
            AND column_name = 'plan'
            AND data_type = 'USER-DEFINED'
        ) THEN
          ALTER TABLE "organizations" ALTER COLUMN "plan" DROP DEFAULT;
          ALTER TABLE "organizations" ALTER COLUMN "plan" TYPE character varying(50) USING "plan"::text;
          ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'free';
        END IF;
      END $$;
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "organizations_plan_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "organizations_plan_enum" AS ENUM('free', 'pro', 'enterprise', 'custom')`,
    );
    await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "plan" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "organizations" ALTER COLUMN "plan" TYPE "organizations_plan_enum" USING "plan"::"organizations_plan_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'free'`);
  }
}
