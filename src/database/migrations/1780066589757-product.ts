import { MigrationInterface, QueryRunner } from 'typeorm';

export class Product1780066589757 implements MigrationInterface {
  name = 'Product1780066589757';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" uuid NOT NULL, "name" character varying NOT NULL, "price" numeric(10,2) NOT NULL, "sku" text, "isAvailable" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_281e3f2c55652d6a22c0aa59fd7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "products" ADD "compareAtPrice" numeric(10,2)`);
    await queryRunner.query(`ALTER TABLE "products" ADD "slug" character varying NOT NULL`);
    await queryRunner.query(`ALTER TABLE "products" ADD "sku" text`);
    await queryRunner.query(`ALTER TABLE "products" ADD "imageUrls" text NOT NULL DEFAULT ''`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD "prepTimeMinutes" integer NOT NULL DEFAULT '10'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "availablePeriod" text NOT NULL DEFAULT 'all_day'`,
    );
    await queryRunner.query(`ALTER TABLE "products" ADD "sortOrder" integer NOT NULL DEFAULT '0'`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD "isFeatured" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "products" ADD "dietaryFlags" text NOT NULL DEFAULT ''`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD "totalOrderCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "averageRating" double precision NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "allergens" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "allergens" SET DEFAULT ''`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4edf40c03594f6824b245427a6" ON "products" ("businessId", "slug") `,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD CONSTRAINT "FK_f515690c571a03400a9876600b5" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT "FK_f515690c571a03400a9876600b5"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_4edf40c03594f6824b245427a6"`);
    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "allergens" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "allergens" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "averageRating"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "totalOrderCount"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "dietaryFlags"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "isFeatured"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "sortOrder"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "availablePeriod"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "prepTimeMinutes"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "imageUrls"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "sku"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "slug"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "compareAtPrice"`);
    await queryRunner.query(`DROP TABLE "product_variants"`);
  }
}
