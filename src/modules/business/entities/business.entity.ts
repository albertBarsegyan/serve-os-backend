import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { BusinessType } from '@common/enums/business-type.enum';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { Staff } from '@modules/staff/entities/staff.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { MenuCategory } from '@modules/menu/entities/category.entity';
import { Product } from '@modules/menu/entities/product.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { Payment } from '@modules/payments/entities/payment.entity';
import { KitchenStation } from '@modules/kitchen/entities/kitchen-station.entity';
import { BusinessPaymentMethod } from '@modules/business/entities/business-payment-method.entity';
import { TableSession } from '@modules/table-sessions/table-session.entity';

@Entity('businesses')
@Index('IDX_business_slug', ['slug'])
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({
    type: 'text',
    default: BusinessType.RESTAURANT,
  })
  type: BusinessType;

  @Column({
    type: 'text',
    array: true,
    nullable: false,
    default: [],
  })
  features: BusinessFeature[];

  @Column()
  location: string;

  @Column()
  currency: string;

  @Column({ type: 'jsonb', nullable: true })
  workingHours: any;

  @Column({ type: 'text', nullable: true, default: null })
  logoUrl: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  posAutoAcceptPayment: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  ownerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @OneToMany(() => Staff, (s) => s.business)
  staff: Staff[];

  @OneToMany(() => Table, (t) => t.business)
  tables: Table[];

  @OneToMany(() => KitchenStation, (k) => k.business)
  kitchenStations: KitchenStation[];

  @OneToMany(() => MenuCategory, (c) => c.business)
  menuCategories: MenuCategory[];

  @OneToMany(() => Product, (p) => p.business)
  products: Product[];

  @OneToMany(() => Order, (o) => o.business)
  orders: Order[];

  @OneToMany(() => Payment, (p) => p.business)
  payments: Payment[];

  @OneToMany(() => BusinessPaymentMethod, (pm) => pm.business)
  paymentMethods: BusinessPaymentMethod[];

  @OneToMany(() => TableSession, (s) => s.business)
  tableSessions: TableSession[];
}
