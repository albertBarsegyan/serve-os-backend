import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTableImageAndReservation1781535727183 implements MigrationInterface {
  name = 'AddTableImageAndReservation1781535727183';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_staff_businessId_employeeId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_images_businessId"`);
    await queryRunner.query(`ALTER TABLE "tables" ADD "isReserved" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "tables" ADD "imageUrl" text`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "imageUrl"`);
    await queryRunner.query(`ALTER TABLE "products" ADD "imageUrl" text`);
    await queryRunner.query(
      `CREATE INDEX "IDX_42f5cd0d79f0925c42b7480e32" ON "images" ("businessId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "UQ_2049c096d2a865a976fa7d34de3" UNIQUE ("businessId", "employeeId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "UQ_2049c096d2a865a976fa7d34de3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_42f5cd0d79f0925c42b7480e32"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "imageUrl"`);
    await queryRunner.query(`ALTER TABLE "products" ADD "imageUrl" character varying`);
    await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN "imageUrl"`);
    await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN "isReserved"`);
    await queryRunner.query(`CREATE INDEX "IDX_images_businessId" ON "images" ("businessId") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_staff_businessId_employeeId" ON "staff" ("businessId", "employeeId") WHERE ("employeeId" IS NOT NULL)`,
    );
  }
}
