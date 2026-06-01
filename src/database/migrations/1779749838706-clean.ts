import { MigrationInterface, QueryRunner } from 'typeorm';

export class Clean1779749838706 implements MigrationInterface {
  name = 'Clean1779749838706';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "firstName" character varying, "lastName" character varying, "role" text NOT NULL DEFAULT 'OWNER', "hasBusiness" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "refreshToken" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "kitchen_stations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "name" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8157ddec935aa73aef0b111c16c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "menu_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "kitchenStationId" uuid, "name" character varying NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "deletedAt" TIMESTAMP, CONSTRAINT "PK_124ae987900336f983881cb04e6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_77cf4c8483ae0e08608d2cb12c" ON "menu_categories" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_item_modifiers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderItemId" uuid NOT NULL, "modifierId" uuid NOT NULL, "modifierName" character varying NOT NULL, "priceAdjustment" numeric(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e87d8ed07e34e0bd3cdc8f64ec8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "modifiers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "name" character varying NOT NULL, "priceAdjustment" numeric(10,2) NOT NULL DEFAULT '0', "position" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f4d68e3a0c8a835c06a9fa27f7e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "modifier_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "name" character varying NOT NULL, "selectionType" text NOT NULL DEFAULT 'SINGLE', "isRequired" boolean NOT NULL DEFAULT false, "minSelections" integer NOT NULL DEFAULT '1', "maxSelections" integer, "position" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "CHK_d8cb359f68604c36f62f0f168c" CHECK ("isRequired" = false OR "minSelections" >= 1), CONSTRAINT "PK_b3cea1c985339de5ea73d77101d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_96bbb563a78afa82258349dffb" ON "modifier_groups" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "categoryId" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "price" numeric(10,2) NOT NULL, "imageUrl" character varying, "kitchenStationId" uuid, "isAvailable" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "allergens" text, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b63efb0c6f580771b76dd64236" ON "products" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "productId" uuid NOT NULL, "quantity" integer NOT NULL, "unitPrice" numeric(10,2) NOT NULL, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "orderId" uuid NOT NULL, "method" text NOT NULL, "status" text NOT NULL DEFAULT 'PENDING', "amount" numeric(10,2) NOT NULL, "confirmedAt" TIMESTAMP, "confirmedById" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "tableId" uuid, "waiterId" uuid, "type" text NOT NULL DEFAULT 'DINE_IN', "status" text NOT NULL DEFAULT 'CREATED', "paymentStatus" text NOT NULL DEFAULT 'UNPAID', "totalAmount" numeric(10,2) NOT NULL DEFAULT '0', "tableSessionId" uuid, "externalOrderId" text, "tipAmount" numeric(10,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_f88f752ea3e66dafde7b6e021a" CHECK ((("type" = 'DINE_IN' AND "tableId" IS NOT NULL AND "tableSessionId" IS NOT NULL) OR
    ("type" = 'TAKEAWAY' AND "tableId" IS NULL AND "tableSessionId" IS NULL) OR
    ("type" NOT IN ('DINE_IN', 'TAKEAWAY')))), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
    await queryRunner.query(
      `CREATE TABLE "staff" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "createdByOwnerId" uuid NOT NULL, "displayName" character varying NOT NULL, "role" text NOT NULL, "authType" text NOT NULL, "pin" text, "passwordHash" text, "email" text, "inviteToken" text, "inviteExpiresAt" TIMESTAMP, "mustChangePassword" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "featureOverrides" jsonb, "deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_786642ee2562e88bbbb96a93dd" ON "staff" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "business_payment_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "method" text NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "config" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_be70afd1a0a0756ad0c63cd58bb" UNIQUE ("businessId", "method"), CONSTRAINT "PK_b512c8d12bafdffa930c233fb5d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_20f5d96397bba8243ffd6daf32" ON "business_payment_methods" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "businesses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "type" text NOT NULL DEFAULT 'RESTAURANT', "features" text array NOT NULL DEFAULT '{}', "location" character varying NOT NULL, "currency" character varying NOT NULL, "workingHours" jsonb, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, CONSTRAINT "UQ_82ca19bc20713fdfa72626a5da0" UNIQUE ("slug"), CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_business_slug" ON "businesses" ("slug") `);
    await queryRunner.query(
      `CREATE TABLE "tables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "number" integer NOT NULL, "qrCode" character varying NOT NULL, "capacity" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c52ef3b2612bd555e91e652a71d" UNIQUE ("qrCode"), CONSTRAINT "PK_7cf2aca7af9550742f855d4eb69" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f79d90f639add2ae7f226d72b" ON "tables" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "table_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tableId" uuid NOT NULL, "businessId" uuid NOT NULL, "sessionToken" character varying NOT NULL, "customerName" text, "customerPhone" text, "isActive" boolean NOT NULL DEFAULT true, "openedAt" TIMESTAMP NOT NULL DEFAULT now(), "closedAt" TIMESTAMP, CONSTRAINT "UQ_3a0283fda474589d13dac93bace" UNIQUE ("sessionToken"), CONSTRAINT "PK_41bb063768931e959eb1f86daa3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_modifier_groups" ("productId" uuid NOT NULL, "modifierGroupId" uuid NOT NULL, CONSTRAINT "PK_b4dbcc646b3bdc142a592ffe406" PRIMARY KEY ("productId", "modifierGroupId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7040749cab439084f923c4bae8" ON "product_modifier_groups" ("productId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5fd9102655e66358ee399b1795" ON "product_modifier_groups" ("modifierGroupId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "kitchen_stations" ADD CONSTRAINT "FK_456dc244dbdff9502e66e7d3b0a" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_categories" ADD CONSTRAINT "FK_260bcad5643c87a997df6c0edc6" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_categories" ADD CONSTRAINT "FK_4f8311d462ffe667929903f0d9c" FOREIGN KEY ("kitchenStationId") REFERENCES "kitchen_stations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "FK_23082a30f06cd8be5306a404efa" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "FK_1eb9a907495da3a71166136e100" FOREIGN KEY ("modifierId") REFERENCES "modifiers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "modifiers" ADD CONSTRAINT "FK_2d404d958f3de9149b371fb9398" FOREIGN KEY ("groupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "modifier_groups" ADD CONSTRAINT "FK_c8b432092d86d812a5e35f0cdc9" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_359bd8406fbfb50e3ea42b5631f" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_ff56834e735fa78a15d0cf21926" FOREIGN KEY ("categoryId") REFERENCES "menu_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_53595d8625823b51833f9bcf95f" FOREIGN KEY ("kitchenStationId") REFERENCES "kitchen_stations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_cdb99c05982d5191ac8465ac010" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_9628bb768218b756d120c5e5454" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_af929a5f2a400fdb6913b4967e1" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_0e2d64b4a9f8b8ad0ef56a035b1" FOREIGN KEY ("confirmedById") REFERENCES "staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_778777c5d7d56ed1bbaa907b8e5" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_2a7fdd7af437285a3ef0fc8b64f" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_0cad548c0f86dfa1e17d68e8899" FOREIGN KEY ("tableSessionId") REFERENCES "table_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_2912d5ae4c5a140b02c1f0c7611" FOREIGN KEY ("waiterId") REFERENCES "staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "FK_97177eca63723272db0babf2187" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "FK_21df99fd22eab124b9f1ee01f94" FOREIGN KEY ("createdByOwnerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_payment_methods" ADD CONSTRAINT "FK_f42be9a1a2fa58277b6e2389a91" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD CONSTRAINT "FK_02e7bfb8e766e8e0ef449cc0f36" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" ADD CONSTRAINT "FK_bdc81552aa8aa4f087e1c8e9525" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_sessions" ADD CONSTRAINT "FK_98097cbf77a9b0c95aa040bf669" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_sessions" ADD CONSTRAINT "FK_ceaf70602d472734bce2e9e0053" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "FK_7040749cab439084f923c4bae89" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "FK_5fd9102655e66358ee399b17955" FOREIGN KEY ("modifierGroupId") REFERENCES "modifier_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_modifier_groups" DROP CONSTRAINT "FK_5fd9102655e66358ee399b17955"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_modifier_groups" DROP CONSTRAINT "FK_7040749cab439084f923c4bae89"`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_sessions" DROP CONSTRAINT "FK_ceaf70602d472734bce2e9e0053"`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_sessions" DROP CONSTRAINT "FK_98097cbf77a9b0c95aa040bf669"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" DROP CONSTRAINT "FK_bdc81552aa8aa4f087e1c8e9525"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP CONSTRAINT "FK_02e7bfb8e766e8e0ef449cc0f36"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_payment_methods" DROP CONSTRAINT "FK_f42be9a1a2fa58277b6e2389a91"`,
    );
    await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "FK_21df99fd22eab124b9f1ee01f94"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "FK_97177eca63723272db0babf2187"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_2912d5ae4c5a140b02c1f0c7611"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_0cad548c0f86dfa1e17d68e8899"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_2a7fdd7af437285a3ef0fc8b64f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_778777c5d7d56ed1bbaa907b8e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_0e2d64b4a9f8b8ad0ef56a035b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_af929a5f2a400fdb6913b4967e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_9628bb768218b756d120c5e5454"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_cdb99c05982d5191ac8465ac010"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_53595d8625823b51833f9bcf95f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_ff56834e735fa78a15d0cf21926"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_359bd8406fbfb50e3ea42b5631f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "modifier_groups" DROP CONSTRAINT "FK_c8b432092d86d812a5e35f0cdc9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "modifiers" DROP CONSTRAINT "FK_2d404d958f3de9149b371fb9398"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_modifiers" DROP CONSTRAINT "FK_1eb9a907495da3a71166136e100"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_modifiers" DROP CONSTRAINT "FK_23082a30f06cd8be5306a404efa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_categories" DROP CONSTRAINT "FK_4f8311d462ffe667929903f0d9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_categories" DROP CONSTRAINT "FK_260bcad5643c87a997df6c0edc6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kitchen_stations" DROP CONSTRAINT "FK_456dc244dbdff9502e66e7d3b0a"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_5fd9102655e66358ee399b1795"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7040749cab439084f923c4bae8"`);
    await queryRunner.query(`DROP TABLE "product_modifier_groups"`);
    await queryRunner.query(`DROP TABLE "table_sessions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3f79d90f639add2ae7f226d72b"`);
    await queryRunner.query(`DROP TABLE "tables"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_business_slug"`);
    await queryRunner.query(`DROP TABLE "businesses"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_20f5d96397bba8243ffd6daf32"`);
    await queryRunner.query(`DROP TABLE "business_payment_methods"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_786642ee2562e88bbbb96a93dd"`);
    await queryRunner.query(`DROP TABLE "staff"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b63efb0c6f580771b76dd64236"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_96bbb563a78afa82258349dffb"`);
    await queryRunner.query(`DROP TABLE "modifier_groups"`);
    await queryRunner.query(`DROP TABLE "modifiers"`);
    await queryRunner.query(`DROP TABLE "order_item_modifiers"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_77cf4c8483ae0e08608d2cb12c"`);
    await queryRunner.query(`DROP TABLE "menu_categories"`);
    await queryRunner.query(`DROP TABLE "kitchen_stations"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
