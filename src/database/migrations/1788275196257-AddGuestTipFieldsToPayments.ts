import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuestTipFieldsToPayments1788275196257 implements MigrationInterface {
  name = 'AddGuestTipFieldsToPayments1788275196257';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ADD "tipAmount" numeric(10,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "payments" ADD "idempotencyKey" character varying`);
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "UQ_743b9fb1d2a059f2f7860418e4e" UNIQUE ("idempotencyKey")`,
    );
    await queryRunner.query(`ALTER TABLE "payments" ADD "tipSource" text`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "tipSourceSessionId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "tipSourceSessionId"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "tipSource"`);
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "UQ_743b9fb1d2a059f2f7860418e4e"`,
    );
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "idempotencyKey"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "tipAmount"`);
  }
}
