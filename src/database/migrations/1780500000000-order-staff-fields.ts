import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderStaffFields1780500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "customerName" text`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "notes" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "notes"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerName"`);
  }
}
