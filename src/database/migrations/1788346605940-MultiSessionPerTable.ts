import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiSessionPerTable1788346605940 implements MigrationInterface {
  name = 'MultiSessionPerTable1788346605940';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_table_sessions_active_table"`);
    await queryRunner.query(`ALTER TABLE "table_sessions" ADD "mergedIntoSessionId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_table_sessions_active_table" ON "table_sessions" ("tableId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "table_sessions" ADD CONSTRAINT "FK_9334e615d2a2296e01cdf6bb21f" FOREIGN KEY ("mergedIntoSessionId") REFERENCES "table_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "table_sessions" DROP CONSTRAINT "FK_9334e615d2a2296e01cdf6bb21f"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_table_sessions_active_table"`);
    await queryRunner.query(`ALTER TABLE "table_sessions" DROP COLUMN "mergedIntoSessionId"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_table_sessions_active_table" ON "table_sessions" ("tableId") WHERE ("isActive" = true)`,
    );
  }
}
