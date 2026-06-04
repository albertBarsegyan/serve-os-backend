import { MigrationInterface, QueryRunner } from 'typeorm';

export class CategoryDescription1780300000000 implements MigrationInterface {
  name = 'CategoryDescription1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_categories" ADD "description" text DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menu_categories" DROP COLUMN "description"`);
  }
}
