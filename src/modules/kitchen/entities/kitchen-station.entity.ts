import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { MenuCategory } from '@modules/menu/entities/category.entity';
import { OrderItem } from '@modules/orders/entities/order-item.entity';

@Entity('kitchen_stations')
export class KitchenStation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business, (b) => b.kitchenStations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => MenuCategory, (c) => c.kitchenStation)
  menuCategories: MenuCategory[];

  @OneToMany(() => OrderItem, (i) => i.kitchenStation)
  orderItems: OrderItem[];
}
