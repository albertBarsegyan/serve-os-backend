import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffEmployeeIdPinLock1780900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" ADD "employeeId" text`);
    await queryRunner.query(
      `ALTER TABLE "staff" ADD "pinFailedAttempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "staff" ADD "pinLockedUntil" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "lastLoginAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "lastLoginIp" text`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "lastLoginTerminal" text`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_staff_businessId_employeeId" ON "staff" ("businessId", "employeeId") WHERE "employeeId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_staff_businessId_employeeId"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "lastLoginTerminal"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "lastLoginIp"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "lastLoginAt"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "pinLockedUntil"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "pinFailedAttempts"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "employeeId"`);
  }
}
