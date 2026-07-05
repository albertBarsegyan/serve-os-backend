import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisplay1783168796513 implements MigrationInterface {
  name = 'AddDisplay1783168796513';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "displays" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessId" uuid NOT NULL, "name" character varying NOT NULL, "tokenHash" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "revokedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_6eac2e54ceff1bad8a3ad4b0c97" UNIQUE ("tokenHash"), CONSTRAINT "PK_b60ee7f4fef83b8d211012e0c0c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "displays" ADD CONSTRAINT "FK_b32a072f148b5be7e66a96daab3" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "displays" DROP CONSTRAINT "FK_b32a072f148b5be7e66a96daab3"`,
    );
    await queryRunner.query(`DROP TABLE "displays"`);
  }
}
