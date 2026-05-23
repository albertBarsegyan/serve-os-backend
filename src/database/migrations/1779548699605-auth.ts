import { MigrationInterface, QueryRunner } from 'typeorm';

export class Auth1779548699605 implements MigrationInterface {
  name = 'Auth1779548699605';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "refreshToken" text`);
    await queryRunner.query(
      `ALTER TYPE "public"."staff_role_enum" RENAME TO "staff_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."staff_role_enum" AS ENUM('OWNER', 'ADMIN', 'WAITER', 'CHEF')`,
    );
    await queryRunner.query(`ALTER TABLE "staff" ALTER COLUMN "role" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "staff" ALTER COLUMN "role" TYPE "public"."staff_role_enum" USING "role"::"text"::"public"."staff_role_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "staff" ALTER COLUMN "role" SET DEFAULT 'WAITER'`);
    await queryRunner.query(
      `ALTER TYPE "public"."businesses_features_enum" RENAME TO "businesses_features_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."businesses_features_enum" AS ENUM('TABLES', 'QR_ORDERING', 'DELIVERY', 'TAKEAWAY', 'DINE_IN', 'KITCHEN', 'KDS', 'RESERVATIONS', 'ROOM_BOOKING', 'BAR_MENU', 'ALCOHOL_SERVICE', 'ONLINE_PAYMENT', 'CASH_PAYMENT', 'POS_PAYMENT', 'STAFF_MANAGEMENT', 'INVENTORY', 'EVENTS', 'MEMBERSHIP', 'MULTI_BRANCH')`,
    );
    await queryRunner.query(`ALTER TABLE "businesses" ALTER COLUMN "features" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "businesses" ALTER COLUMN "features" TYPE "public"."businesses_features_enum"[] USING "features"::"text"::"public"."businesses_features_enum"[]`,
    );
    await queryRunner.query(`ALTER TABLE "businesses" ALTER COLUMN "features" SET DEFAULT '{}'`);
    await queryRunner.query(`DROP TYPE "public"."businesses_features_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."businesses_features_enum_old" AS ENUM('TABLES', 'QR_ORDERING', 'DELIVERY', 'TAKEAWAY', 'DINE_IN', 'KITCHEN', 'KDS', 'RESERVATIONS', 'ROOM_BOOKING', 'BAR_MENU', 'ALCOHOL_SERVICE', 'ONLINE_PAYMENT', 'CASH_PAYMENT', 'POS_PAYMENT', 'STAFF_MANAGEMENT', 'INVENTORY', 'EVENTS', 'MEMBERSHIP', 'MULTI_BRANCH')`,
    );
    await queryRunner.query(`ALTER TABLE "businesses" ALTER COLUMN "features" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "businesses" ALTER COLUMN "features" TYPE "public"."businesses_features_enum_old"[] USING "features"::"text"::"public"."businesses_features_enum_old"[]`,
    );
    await queryRunner.query(`ALTER TABLE "businesses" ALTER COLUMN "features" SET DEFAULT '{}'`);
    await queryRunner.query(`DROP TYPE "public"."businesses_features_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."businesses_features_enum_old" RENAME TO "businesses_features_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."staff_role_enum_old" AS ENUM('OWNER', 'ADMIN', 'WAITER', 'CHEF')`,
    );
    await queryRunner.query(`ALTER TABLE "staff" ALTER COLUMN "role" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "staff" ALTER COLUMN "role" TYPE "public"."staff_role_enum_old" USING "role"::"text"::"public"."staff_role_enum_old"`,
    );
    await queryRunner.query(`ALTER TABLE "staff" ALTER COLUMN "role" SET DEFAULT 'WAITER'`);
    await queryRunner.query(`DROP TYPE "public"."staff_role_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."staff_role_enum_old" RENAME TO "staff_role_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refreshToken"`);
  }
}
