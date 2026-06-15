import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageFields1780700000000 implements MigrationInterface {
  name = 'AddImageFields1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "logoUrl" text DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" text DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "avatarUrl" text DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_categories" ADD COLUMN IF NOT EXISTS "imageUrl" text DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menu_categories" DROP COLUMN IF EXISTS "imageUrl"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN IF EXISTS "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "logoUrl"`);
  }
}
