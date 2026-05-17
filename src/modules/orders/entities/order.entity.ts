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
import { Table } from '@modules/tables/entities/table.entity';
import { OrderItem } from './order-item.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { Payment } from '@modules/payments/entities/payment.entity';
import { CustomerSession } from '@modules/customer-session/entities/customer-session.entity';
import { PaymentMethod, OrderPaymentStatus } from '@common/enums/payment.enum';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

// payment enums moved to common enums to avoid duplication and import cycles

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  tableId: string;

  @ManyToOne(() => Table)
  @JoinColumn({ name: 'tableId' })
  table: Table;

  @Column({ nullable: true })
  waiterId: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
    enumName: 'order_status_enum',
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'order_payment_method_enum',
    nullable: true,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: OrderPaymentStatus,
    enumName: 'order_payment_status_enum',
    default: OrderPaymentStatus.UNPAID,
  })
  paymentStatus: OrderPaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ nullable: true })
  customerSessionId: string;

  @ManyToOne(() => CustomerSession, (s) => s.orders, { nullable: true })
  @JoinColumn({ name: 'customerSessionId' })
  customerSession: CustomerSession;

  @ManyToOne(() => Staff, (s) => s.servedOrders, { nullable: true })
  @JoinColumn({ name: 'waiterId' })
  waiter: Staff;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: ['insert', 'update'] })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Payment, (p) => p.order)
  payments: Payment[];
}
