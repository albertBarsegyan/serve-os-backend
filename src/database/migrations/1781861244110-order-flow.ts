import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderFlow1781861244110 implements MigrationInterface {
  name = 'OrderFlow1781861244110';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "cancelReason" character varying(500)`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "autoConfirmed" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "confirmedById" uuid`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "cancelledById" uuid`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "confirmedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "preparationStartedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "readyAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "servedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "cancelledAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_0cf16cf1d67b273c7c34b494681" FOREIGN KEY ("confirmedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_303fee34b638662ba4d05392fa5" FOREIGN KEY ("cancelledById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_303fee34b638662ba4d05392fa5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_0cf16cf1d67b273c7c34b494681"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "cancelledAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "servedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "readyAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "preparationStartedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "confirmedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "cancelledById"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "confirmedById"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "autoConfirmed"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "cancelReason"`);
  }
}
