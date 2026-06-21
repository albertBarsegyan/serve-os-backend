import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Payment } from './payment.entity';
import { OrderItem } from '@modules/orders/entities/order-item.entity';

@Entity('payment_allocations')
export class PaymentAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  paymentId: string;

  @ManyToOne(() => Payment, (p) => p.allocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Index()
  @Column()
  orderItemId: string;

  @ManyToOne(() => OrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItem;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
