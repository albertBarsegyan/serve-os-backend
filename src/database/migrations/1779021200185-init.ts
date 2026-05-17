import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1779021200185 implements MigrationInterface {
  name = 'Init1779021200185';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "number" integer NOT NULL, "qrCode" character varying NOT NULL, "capacity" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c52ef3b2612bd555e91e652a71d" UNIQUE ("qrCode"), CONSTRAINT "PK_7cf2aca7af9550742f855d4eb69" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "kitchen_stations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "name" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8157ddec935aa73aef0b111c16c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "menu_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "kitchenStationId" uuid, "name" character varying NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_124ae987900336f983881cb04e6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_item_modifiers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderItemId" uuid NOT NULL, "modifierId" uuid NOT NULL, "modifierName" character varying NOT NULL, "priceAdjustment" numeric(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e87d8ed07e34e0bd3cdc8f64ec8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "modifiers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "name" character varying NOT NULL, "priceAdjustment" numeric(10,2) NOT NULL DEFAULT '0', "position" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f4d68e3a0c8a835c06a9fa27f7e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."modifier_selection_type_enum" AS ENUM('SINGLE', 'MULTIPLE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "modifier_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "name" character varying NOT NULL, "selectionType" "public"."modifier_selection_type_enum" NOT NULL DEFAULT 'SINGLE', "isRequired" boolean NOT NULL DEFAULT false, "minSelections" integer NOT NULL DEFAULT '1', "maxSelections" integer, "position" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b3cea1c985339de5ea73d77101d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "categoryId" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "price" numeric(10,2) NOT NULL, "imageUrl" character varying, "isAvailable" boolean NOT NULL DEFAULT true, "allergens" text, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "productId" uuid NOT NULL, "quantity" integer NOT NULL, "unitPrice" numeric(10,2) NOT NULL, "notes" text, "kitchenStationId" uuid, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_method_enum" AS ENUM('CASH', 'POS', 'ONLINE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "orderId" uuid NOT NULL, "method" "public"."payment_method_enum" NOT NULL, "status" "public"."payment_status_enum" NOT NULL DEFAULT 'PENDING', "amount" numeric(10,2) NOT NULL, "confirmedAt" TIMESTAMP, "confirmedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "tableId" uuid NOT NULL, "token" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4cf157c26195ab69895f8fbf75b" UNIQUE ("token"), CONSTRAINT "PK_c684ecbaa67a634723776229c4c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CLOSED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_payment_method_enum" AS ENUM('CASH', 'POS', 'ONLINE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_payment_status_enum" AS ENUM('UNPAID', 'PAID')`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "tableId" uuid NOT NULL, "waiterId" uuid, "status" "public"."order_status_enum" NOT NULL DEFAULT 'PENDING', "paymentMethod" "public"."order_payment_method_enum", "paymentStatus" "public"."order_payment_status_enum" NOT NULL DEFAULT 'UNPAID', "totalAmount" numeric(10,2) NOT NULL DEFAULT '0', "customerSessionId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."staff_role_enum" AS ENUM('OWNER', 'ADMIN', 'WAITER', 'CHEF')`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_invites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "invitedBy" uuid NOT NULL, "email" character varying NOT NULL, "role" "public"."staff_role_enum" NOT NULL, "token" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "isAccepted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_564f4de644bb76d796ec13bb5a2" UNIQUE ("token"), CONSTRAINT "PK_cddb3842cd5868d1ae4240e1a8d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_564f4de644bb76d796ec13bb5a" ON "staff_invites" ("token") `,
    );
    await queryRunner.query(
      `CREATE TABLE "staff" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."staff_role_enum" NOT NULL DEFAULT 'WAITER', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d0e0db8b9c3e6cf3bbfc5b97034" UNIQUE ("userId", "businessId"), CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."business_payment_method_enum" AS ENUM('CASH', 'POS', 'ONLINE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_payment_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "method" "public"."business_payment_method_enum" NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "config" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_be70afd1a0a0756ad0c63cd58bb" UNIQUE ("businessId", "method"), CONSTRAINT "PK_b512c8d12bafdffa930c233fb5d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."business_type_enum" AS ENUM('RESTAURANT', 'CAFE', 'BAR', 'PUB', 'BAKERY', 'FAST_FOOD', 'FOOD_TRUCK', 'PIZZERIA', 'STEAKHOUSE', 'SEAFOOD_RESTAURANT', 'SUSHI_BAR', 'BUFFET', 'ICE_CREAM_SHOP', 'JUICE_BAR', 'COFFEE_SHOP', 'TEA_HOUSE', 'WINE_BAR', 'COCKTAIL_BAR', 'BREWERY', 'NIGHTCLUB', 'HOTEL', 'HOSTEL', 'RESORT', 'MOTEL', 'GUEST_HOUSE', 'APARTMENT_HOTEL', 'CASINO', 'LOUNGE', 'KARAOKE', 'CINEMA', 'EVENT_VENUE', 'CATERING', 'BANQUET_HALL', 'PRIVATE_CLUB', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."businesses_features_enum" AS ENUM('TABLES', 'QR_ORDERING', 'DELIVERY', 'TAKEAWAY', 'DINE_IN', 'KITCHEN', 'KDS', 'RESERVATIONS', 'ROOM_BOOKING', 'BAR_MENU', 'ALCOHOL_SERVICE', 'ONLINE_PAYMENT', 'CASH_PAYMENT', 'POS_PAYMENT', 'STAFF_MANAGEMENT', 'INVENTORY', 'EVENTS', 'MEMBERSHIP', 'MULTI_BRANCH')`,
    );
    await queryRunner.query(
      `CREATE TABLE "businesses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "type" "public"."business_type_enum" NOT NULL DEFAULT 'RESTAURANT', "features" "public"."businesses_features_enum" array NOT NULL DEFAULT '{}', "location" character varying NOT NULL, "currency" character varying NOT NULL, "workingHours" jsonb, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, CONSTRAINT "UQ_82ca19bc20713fdfa72626a5da0" UNIQUE ("slug"), CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_business_slug" ON "businesses" ("slug") `);
    await queryRunner.query(
      `CREATE TYPE "public"."role_enum" AS ENUM('OWNER', 'ADMIN', 'WAITER', 'CHEF')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "firstName" character varying, "lastName" character varying, "role" "public"."role_enum" NOT NULL DEFAULT 'OWNER', "hasBusiness" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
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
      `ALTER TABLE "tables" ADD CONSTRAINT "FK_bdc81552aa8aa4f087e1c8e9525" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_cdb99c05982d5191ac8465ac010" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_d80ab39f8f9202dfadcca0b1847" FOREIGN KEY ("kitchenStationId") REFERENCES "kitchen_stations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_9628bb768218b756d120c5e5454" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_af929a5f2a400fdb6913b4967e1" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_276f561b424b7b99c0fd1996ce6" FOREIGN KEY ("confirmedBy") REFERENCES "staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_sessions" ADD CONSTRAINT "FK_c6912782c4066c724604e408dc1" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_sessions" ADD CONSTRAINT "FK_4cb47709f158b8736fee09b390c" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_778777c5d7d56ed1bbaa907b8e5" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_2a7fdd7af437285a3ef0fc8b64f" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_93f47488bd87464e7d90e85a5bf" FOREIGN KEY ("customerSessionId") REFERENCES "customer_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_2912d5ae4c5a140b02c1f0c7611" FOREIGN KEY ("waiterId") REFERENCES "staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_invites" ADD CONSTRAINT "FK_105d2b44e3f01634e987969cb7c" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_invites" ADD CONSTRAINT "FK_4e6efb2492b01c82995e18b758f" FOREIGN KEY ("invitedBy") REFERENCES "staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "FK_97177eca63723272db0babf2187" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "FK_eba76c23bcfc9dad2479b7fd2ad" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_payment_methods" ADD CONSTRAINT "FK_f42be9a1a2fa58277b6e2389a91" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD CONSTRAINT "FK_02e7bfb8e766e8e0ef449cc0f36" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
      `ALTER TABLE "businesses" DROP CONSTRAINT "FK_02e7bfb8e766e8e0ef449cc0f36"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_payment_methods" DROP CONSTRAINT "FK_f42be9a1a2fa58277b6e2389a91"`,
    );
    await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "FK_eba76c23bcfc9dad2479b7fd2ad"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "FK_97177eca63723272db0babf2187"`);
    await queryRunner.query(
      `ALTER TABLE "staff_invites" DROP CONSTRAINT "FK_4e6efb2492b01c82995e18b758f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_invites" DROP CONSTRAINT "FK_105d2b44e3f01634e987969cb7c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_2912d5ae4c5a140b02c1f0c7611"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_93f47488bd87464e7d90e85a5bf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_2a7fdd7af437285a3ef0fc8b64f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_778777c5d7d56ed1bbaa907b8e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_sessions" DROP CONSTRAINT "FK_4cb47709f158b8736fee09b390c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_sessions" DROP CONSTRAINT "FK_c6912782c4066c724604e408dc1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_276f561b424b7b99c0fd1996ce6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_af929a5f2a400fdb6913b4967e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_9628bb768218b756d120c5e5454"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_d80ab39f8f9202dfadcca0b1847"`,
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
    await queryRunner.query(
      `ALTER TABLE "tables" DROP CONSTRAINT "FK_bdc81552aa8aa4f087e1c8e9525"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_5fd9102655e66358ee399b1795"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7040749cab439084f923c4bae8"`);
    await queryRunner.query(`DROP TABLE "product_modifier_groups"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_business_slug"`);
    await queryRunner.query(`DROP TABLE "businesses"`);
    await queryRunner.query(`DROP TYPE "public"."businesses_features_enum"`);
    await queryRunner.query(`DROP TYPE "public"."business_type_enum"`);
    await queryRunner.query(`DROP TABLE "business_payment_methods"`);
    await queryRunner.query(`DROP TYPE "public"."business_payment_method_enum"`);
    await queryRunner.query(`DROP TABLE "staff"`);
    await queryRunner.query(`DROP TYPE "public"."staff_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_564f4de644bb76d796ec13bb5a"`);
    await queryRunner.query(`DROP TABLE "staff_invites"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."order_payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."order_payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "public"."order_status_enum"`);
    await queryRunner.query(`DROP TABLE "customer_sessions"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_method_enum"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "modifier_groups"`);
    await queryRunner.query(`DROP TYPE "public"."modifier_selection_type_enum"`);
    await queryRunner.query(`DROP TABLE "modifiers"`);
    await queryRunner.query(`DROP TABLE "order_item_modifiers"`);
    await queryRunner.query(`DROP TABLE "menu_categories"`);
    await queryRunner.query(`DROP TABLE "kitchen_stations"`);
    await queryRunner.query(`DROP TABLE "tables"`);
  }
}
