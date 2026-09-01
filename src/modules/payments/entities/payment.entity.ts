import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { PaymentMethod, PaymentStatus, TipSource } from '@common/enums/payment.enum';
import { Staff } from '@modules/staff/entities/staff.entity';
import { PaymentAllocation } from './payment-allocation.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'text' })
  method: PaymentMethod;

  @Column({
    type: 'text',
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  // The tip-classified portion of `amount`. Order.tipAmount is a denormalized cache
  // recomputed as SUM(tipAmount) over this order's CONFIRMED payments — Payment is the
  // source of truth so guest and staff tip writes never silently clobber each other.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tipAmount: number;

  // Nullable + unique (Postgres allows multiple NULLs under a unique constraint) so only
  // the idempotency-key-bearing guest tip route enforces replay protection; staff-initiated
  // payments never set this.
  @Column({ type: 'varchar', nullable: true, unique: true, default: null })
  idempotencyKey: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  tipSource: TipSource | null;

  // TableSession.id, not the raw session token — enough to audit which guest session wrote
  // this tip without persisting a live bearer credential in a durable table.
  @Column({ type: 'uuid', nullable: true, default: null })
  tipSourceSessionId: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  providerRef: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  providerStatus: string | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ nullable: true })
  confirmedById: string | null;

  @ManyToOne(() => Staff, (s) => s.confirmedPayments, { nullable: true })
  @JoinColumn({ name: 'confirmedById' })
  confirmedBy: Staff;

  @OneToMany(() => PaymentAllocation, (a) => a.payment)
  allocations: PaymentAllocation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
