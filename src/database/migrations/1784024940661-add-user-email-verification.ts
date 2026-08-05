import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserEmailVerification1784024940661 implements MigrationInterface {
  name = 'AddUserEmailVerification1784024940661';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationToken" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationExpiresAt" TIMESTAMP`);
    // Grandfather in accounts that already existed before this migration —
    // they predate the verification requirement and shouldn't be locked
    // out of business creation / staff invites / payment config. Only
    // rows newly inserted after this point default to unverified.
    await queryRunner.query(`UPDATE "users" SET "emailVerified" = true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationToken"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerified"`);
  }
}
