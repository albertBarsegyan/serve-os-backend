import { MigrationInterface, QueryRunner } from 'typeorm';

export class QrOrderFlowPayments1782000000000 implements MigrationInterface {
  name = 'QrOrderFlowPayments1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add provider tracking columns to payments
    await queryRunner.query(`ALTER TABLE "payments" ADD "providerRef" character varying`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "providerStatus" character varying`);

    // payment_allocations — per-item split bookkeeping
    await queryRunner.query(`
      CREATE TABLE "payment_allocations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "paymentId" uuid NOT NULL,
        "orderItemId" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_allocations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payment_allocations_paymentId" ON "payment_allocations" ("paymentId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payment_allocations_orderItemId" ON "payment_allocations" ("orderItemId")
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_allocations"
        ADD CONSTRAINT "FK_payment_allocations_payment"
        FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_allocations"
        ADD CONSTRAINT "FK_payment_allocations_order_item"
        FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_order_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_payment"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_payment_allocations_orderItemId"`);
    await queryRunner.query(`DROP INDEX "IDX_payment_allocations_paymentId"`);
    await queryRunner.query(`DROP TABLE "payment_allocations"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "providerStatus"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "providerRef"`);
  }
}
