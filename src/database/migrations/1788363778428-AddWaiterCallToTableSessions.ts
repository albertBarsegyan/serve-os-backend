import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWaiterCallToTableSessions1788363778428 implements MigrationInterface {
  name = 'AddWaiterCallToTableSessions1788363778428';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "table_sessions" ADD "waiterCallActive" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "table_sessions" ADD "waiterCallAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "table_sessions" DROP COLUMN "waiterCallAt"`);
    await queryRunner.query(`ALTER TABLE "table_sessions" DROP COLUMN "waiterCallActive"`);
  }
}
