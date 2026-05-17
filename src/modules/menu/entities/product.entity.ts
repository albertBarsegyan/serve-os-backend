import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { MenuCategory } from './category.entity';
import { OrderItem } from '@modules/orders/entities/order-item.entity';
import { ModifierGroup } from '@modules/modifiers/entities/modifier-group.entity';

@Entity('products')
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

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ type: 'simple-array', nullable: true })
  allergens: string[];

  @OneToMany(() => OrderItem, (i) => i.product)
  orderItems: OrderItem[];

  @ManyToMany(() => ModifierGroup, (g) => g.products)
  @JoinTable({
    name: 'product_modifier_groups',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'modifierGroupId', referencedColumnName: 'id' },
  })
  modifierGroups: ModifierGroup[];
}
