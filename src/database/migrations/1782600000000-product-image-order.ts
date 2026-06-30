import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductImageOrder1782600000000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // products.imageUrls (simple-array) stores images in user-defined order.
    // Index 0 is the main/cover image — enforced by application logic via
    // PATCH /menu/products/:id/images/reorder. No schema change required.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
