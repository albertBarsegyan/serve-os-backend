import { MigrationInterface, QueryRunner } from 'typeorm';

export class PosAutoAcceptPayment1782432894410 implements MigrationInterface {
  name = 'PosAutoAcceptPayment1782432894410';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_order_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_payment"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_allocations_paymentId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_allocations_orderItemId"`);
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "posAutoAcceptPayment" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_68129272bde8768a20d6967a62" ON "payment_allocations" ("paymentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b83b0472a6a56acd44dc191e0b" ON "payment_allocations" ("orderItemId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_68129272bde8768a20d6967a62c" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_b83b0472a6a56acd44dc191e0b5" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_b83b0472a6a56acd44dc191e0b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_68129272bde8768a20d6967a62c"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_b83b0472a6a56acd44dc191e0b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_68129272bde8768a20d6967a62"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "posAutoAcceptPayment"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_allocations_orderItemId" ON "payment_allocations" ("orderItemId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_allocations_paymentId" ON "payment_allocations" ("paymentId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_payment_allocations_payment" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_payment_allocations_order_item" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
