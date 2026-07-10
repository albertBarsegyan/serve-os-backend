import { MigrationInterface, QueryRunner } from 'typeorm';

export class TableSessionActiveUniqueIndex1783548053432 implements MigrationInterface {
  name = 'TableSessionActiveUniqueIndex1783548053432';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_table_sessions_active_table" ON "table_sessions" ("tableId") WHERE "isActive" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_table_sessions_active_table"`);
  }
}
