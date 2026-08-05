import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffEmailUniquePerBusiness1784030000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normalize existing data first so the index (and the app-level checks
    // that now guard every write path) are comparing on the same casing.
    await queryRunner.query(
      `UPDATE "staff" SET "email" = lower(trim("email")) WHERE "email" IS NOT NULL`,
    );

    const duplicates: Array<{ businessId: string; email_lc: string; count: string }> =
      (await queryRunner.query(`
        SELECT "businessId", "email" AS email_lc, COUNT(*) AS count
        FROM "staff"
        WHERE "email" IS NOT NULL
        GROUP BY "businessId", "email"
        HAVING COUNT(*) > 1
      `)) as Array<{ businessId: string; email_lc: string; count: string }>;

    if (duplicates.length > 0) {
      const summary = duplicates
        .map((d) => `businessId=${d.businessId} email=${d.email_lc} (${d.count} rows)`)
        .join('; ');
      throw new Error(
        `Cannot add unique staff email index: duplicate (businessId, email) rows exist — ${summary}. ` +
          `Resolve these manually (rename or deactivate the extra accounts) before re-running this migration.`,
      );
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_staff_businessId_email" ON "staff" ("businessId", "email") WHERE "email" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_staff_businessId_email"`);
  }
}
