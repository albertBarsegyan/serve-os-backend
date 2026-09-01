import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPreviousRefreshTokenToUser1788102195346 implements MigrationInterface {
  name = 'AddPreviousRefreshTokenToUser1788102195346';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "previousRefreshToken" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD "refreshTokenRotatedAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refreshTokenRotatedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "previousRefreshToken"`);
  }
}
