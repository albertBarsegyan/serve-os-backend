import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1776982216474 implements MigrationInterface {
  name = 'Init1776982216474';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "firstName" character varying, "lastName" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."businesses_type_enum" AS ENUM('RESTAURANT', 'CAFE', 'BAR')`,
    );
    await queryRunner.query(
      `CREATE TABLE "businesses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" "public"."businesses_type_enum" NOT NULL DEFAULT 'RESTAURANT', "location" character varying NOT NULL, "currency" character varying NOT NULL, "workingHours" jsonb, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "number" integer NOT NULL, "qrCode" character varying NOT NULL, "capacity" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_c52ef3b2612bd555e91e652a71d" UNIQUE ("qrCode"), CONSTRAINT "PK_7cf2aca7af9550742f855d4eb69" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."staff_role_enum" AS ENUM('OWNER', 'ADMIN', 'WAITER', 'CHEF')`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."staff_role_enum" NOT NULL DEFAULT 'WAITER', CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "name" character varying NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "categoryId" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "price" numeric(10,2) NOT NULL, "imageUrl" character varying, "isAvailable" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "productId" uuid NOT NULL, "quantity" integer NOT NULL, "unitPrice" numeric(10,2) NOT NULL, "notes" text, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CLOSED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_paymentmethod_enum" AS ENUM('CASH', 'POS', 'ONLINE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_paymentstatus_enum" AS ENUM('UNPAID', 'PAID')`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "tableId" uuid NOT NULL, "staffId" character varying, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'PENDING', "paymentMethod" "public"."orders_paymentmethod_enum", "paymentStatus" "public"."orders_paymentstatus_enum" NOT NULL DEFAULT 'UNPAID', "totalAmount" numeric(10,2) NOT NULL DEFAULT '0', "sessionToken" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_method_enum" AS ENUM('CASH', 'POS', 'ONLINE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "orderId" uuid NOT NULL, "method" "public"."payments_method_enum" NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "amount" numeric(10,2) NOT NULL, "confirmedAt" TIMESTAMP, "confirmedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" ADD CONSTRAINT "FK_bdc81552aa8aa4f087e1c8e9525" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "FK_97177eca63723272db0babf2187" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "FK_eba76c23bcfc9dad2479b7fd2ad" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_a018fc1aa37f34fdde4f0a1982c" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_359bd8406fbfb50e3ea42b5631f" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_ff56834e735fa78a15d0cf21926" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_cdb99c05982d5191ac8465ac010" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_778777c5d7d56ed1bbaa907b8e5" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_2a7fdd7af437285a3ef0fc8b64f" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_9628bb768218b756d120c5e5454" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_af929a5f2a400fdb6913b4967e1" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_af929a5f2a400fdb6913b4967e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_9628bb768218b756d120c5e5454"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_2a7fdd7af437285a3ef0fc8b64f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_778777c5d7d56ed1bbaa907b8e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_cdb99c05982d5191ac8465ac010"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_ff56834e735fa78a15d0cf21926"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_359bd8406fbfb50e3ea42b5631f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_a018fc1aa37f34fdde4f0a1982c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" DROP CONSTRAINT "FK_eba76c23bcfc9dad2479b7fd2ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" DROP CONSTRAINT "FK_97177eca63723272db0babf2187"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" DROP CONSTRAINT "FK_bdc81552aa8aa4f087e1c8e9525"`,
    );
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_paymentstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_paymentmethod_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "staff"`);
    await queryRunner.query(`DROP TYPE "public"."staff_role_enum"`);
    await queryRunner.query(`DROP TABLE "tables"`);
    await queryRunner.query(`DROP TABLE "businesses"`);
    await queryRunner.query(`DROP TYPE "public"."businesses_type_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
