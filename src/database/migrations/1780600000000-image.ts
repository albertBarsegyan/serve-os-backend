import { MigrationInterface, QueryRunner } from 'typeorm';

export class Image1780600000000 implements MigrationInterface {
  name = 'Image1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying NOT NULL, "url" character varying NOT NULL, "mimeType" character varying NOT NULL, "size" bigint NOT NULL, "uploadedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_images_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "images"`);
  }
}
