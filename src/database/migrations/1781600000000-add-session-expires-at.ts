import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionExpiresAt1781600000000 implements MigrationInterface {
  name = 'AddSessionExpiresAt1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "table_sessions" ADD "expiresAt" TIMESTAMP`);
    // Backfill active sessions so they don't expire immediately after deploy
    await queryRunner.query(
      `UPDATE "table_sessions" SET "expiresAt" = NOW() + INTERVAL '8 hours' WHERE "isActive" = true AND "expiresAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "table_sessions" DROP COLUMN "expiresAt"`);
  }
}
