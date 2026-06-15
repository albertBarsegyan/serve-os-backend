import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('images')
export class Image {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  key: string;

  @Column()
  url: string;

  @Column()
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ nullable: true, type: 'uuid' })
  uploadedBy: string | null;

  /** Business that owns this image. Null only for user-avatar uploads. */
  @Index()
  @Column({ nullable: true, type: 'uuid' })
  businessId: string | null;

  /** Storage path category — mirrors ImageEntityType values. */
  @Column({ nullable: true, type: 'varchar', length: 50 })
  entityType: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
