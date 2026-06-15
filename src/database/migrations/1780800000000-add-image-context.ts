import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageContext1780800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "businessId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "entityType" character varying(50)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_images_businessId" ON "images" ("businessId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_images_businessId"`);
    await queryRunner.query(`ALTER TABLE "images" DROP COLUMN IF EXISTS "entityType"`);
    await queryRunner.query(`ALTER TABLE "images" DROP COLUMN IF EXISTS "businessId"`);
  }
}
