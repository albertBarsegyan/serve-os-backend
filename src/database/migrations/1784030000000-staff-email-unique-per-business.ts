import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffEmailUniquePerBusiness1784030000000 implements MigrationInterface {
  name = 'StaffEmailUniquePerBusiness1784030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check the canonical values first. This leaves production data untouched
    // when remediation is needed; TypeORM runs this migration transactionally.
    const duplicates: Array<{ businessId: string; email_lc: string; count: string }> =
      (await queryRunner.query(`
        SELECT "businessId", lower(btrim("email")) AS email_lc, COUNT(*) AS count
        FROM "staff"
        WHERE "email" IS NOT NULL
        GROUP BY "businessId", lower(btrim("email"))
        HAVING COUNT(*) > 1
      `)) as Array<{ businessId: string; email_lc: string; count: string }>;

    if (duplicates.length > 0) {
      const summary = duplicates
        .map((d) => `businessId=${d.businessId} email=${d.email_lc} (${d.count} rows)`)
        .join('; ');
      throw new Error(
        `Cannot add unique staff email index: duplicate (businessId, email) rows exist — ${summary}. ` +
          `Resolve them manually before re-running this migration; see docs/staff-email-unique-per-business.md.`,
      );
    }

    // Persist canonical values before enforcing the index so future lookups and
    // writes compare the same representation.
    await queryRunner.query(
      `UPDATE "staff" SET "email" = lower(btrim("email")) WHERE "email" IS DISTINCT FROM lower(btrim("email"))`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_staff_businessId_email" ON "staff" ("businessId", "email") WHERE "email" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_staff_businessId_email"`);
  }
}
