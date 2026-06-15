import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { MenuCategory } from './category.entity';
import { OrderItem } from '@modules/orders/entities/order-item.entity';
import { ModifierGroup } from '@modules/modifiers/entities/modifier-group.entity';
import { KitchenStation } from '@modules/kitchen/entities/kitchen-station.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('products')
@Index(['businessId', 'slug'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  categoryId: string;

  @ManyToOne(() => MenuCategory, (category) => category.products)
  @JoinColumn({ name: 'categoryId' })
  category: MenuCategory;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  compareAtPrice: number | null;

  @Column({ unique: false })
  slug: string;

  @Column({ nullable: true, type: 'text' })
  sku: string | null;

  @Column({ nullable: true, type: 'text' })
  imageUrl: string;

  @Column({ type: 'simple-array', default: '' })
  imageUrls: string[];

  @Column({ nullable: true })
  kitchenStationId: string | null;

  @ManyToOne(() => KitchenStation, (k) => k.products, { nullable: true })
  @JoinColumn({ name: 'kitchenStationId' })
  kitchenStation: KitchenStation | null;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ type: 'int', default: 10 })
  prepTimeMinutes: number;

  @Column({ type: 'text', default: 'all_day' })
  availablePeriod: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ type: 'simple-array', default: '' })
  dietaryFlags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  @Index()
  deletedAt: Date | null;

  @Column({ type: 'simple-array', default: '' })
  allergens: string[];

  @Column({ type: 'int', default: 0 })
  totalOrderCount: number;

  @Column({ type: 'float', default: 0 })
  averageRating: number;

  @OneToMany(() => OrderItem, (i) => i.product)
  orderItems: OrderItem[];

  @OneToMany(() => ProductVariant, (v) => v.product, { cascade: true, eager: true })
  variants: ProductVariant[];

  @ManyToMany(() => ModifierGroup, (g) => g.products)
  @JoinTable({
    name: 'product_modifier_groups',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'modifierGroupId', referencedColumnName: 'id' },
  })
  modifierGroups: ModifierGroup[];
}
