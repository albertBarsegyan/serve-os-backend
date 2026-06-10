import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModifierPriceType1780400000000 implements MigrationInterface {
  name = 'ModifierPriceType1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "modifiers" ADD "priceType" character varying NOT NULL DEFAULT 'adjustment'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "modifiers" DROP COLUMN "priceType"`);
  }
}
