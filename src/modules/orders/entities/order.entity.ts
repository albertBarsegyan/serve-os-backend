import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  Check,
} from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { Business } from '@modules/business/entities/business.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { OrderItem } from './order-item.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { Payment } from '@modules/payments/entities/payment.entity';
import { OrderPaymentStatus } from '@common/enums/payment.enum';
import { OrderStatus } from './order-status.enum';
import { OrderType } from './order-type.enum';
import { TableSession } from '@modules/table-sessions/table-session.entity';

// payment enums moved to common enums to avoid duplication and import cycles

@Entity('orders')
@Check(
  `(("type" = 'DINE_IN' AND "tableId" IS NOT NULL AND "tableSessionId" IS NOT NULL) OR
    ("type" = 'TAKEAWAY' AND "tableId" IS NULL AND "tableSessionId" IS NULL) OR
    ("type" NOT IN ('DINE_IN', 'TAKEAWAY')))`,
)
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  // Nullable because TAKEAWAY orders do not belong to a table/session pair;
  // DINE_IN orders must populate both fields and the entity listener enforces that.
  @Column({ nullable: true })
  tableId: string | null;

  @ManyToOne(() => Table, { nullable: true })
  @JoinColumn({ name: 'tableId' })
  table: Table | null;

  @Column({ nullable: true })
  waiterId: string | null;

  @Column({
    type: 'text',
    default: OrderType.DINE_IN,
  })
  type: OrderType;

  @Column({
    type: 'text',
    default: OrderStatus.CREATED,
  })
  status: OrderStatus;

  @Column({
    type: 'text',
    default: OrderPaymentStatus.UNPAID,
  })
  paymentStatus: OrderPaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  // Nullable because only DINE_IN orders reference a table session; TAKEAWAY and other
  // non-table orders intentionally keep this column empty.
  @Column({ nullable: true })
  tableSessionId: string | null;

  @ManyToOne(() => TableSession, (s) => s.orders, { nullable: true })
  @JoinColumn({ name: 'tableSessionId' })
  tableSession: TableSession | null;

  @Column({ nullable: true, type: 'text' })
  externalOrderId: string | null;

  @Column({ nullable: true, type: 'text' })
  customerName: string | null;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  cancelReason: string | null;

  @Column({ default: false })
  autoConfirmed: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tipAmount: number;

  @Column({ nullable: true })
  confirmedById: string | null;

  @ManyToOne(() => Staff, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmedById' })
  confirmedBy: Staff | null;

  @Column({ nullable: true })
  cancelledById: string | null;

  @ManyToOne(() => Staff, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cancelledById' })
  cancelledBy: Staff | null;

  @ManyToOne(() => Staff, (s) => s.servedOrders, { nullable: true })
  @JoinColumn({ name: 'waiterId' })
  waiter: Staff | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: ['insert', 'update'] })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true, default: null })
  confirmedAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true, default: null })
  preparationStartedAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true, default: null })
  readyAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true, default: null })
  servedAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true, default: null })
  cancelledAt: Date | null;

  @OneToMany(() => Payment, (p) => p.order)
  payments: Payment[];

  @BeforeInsert()
  @BeforeUpdate()
  validateTableAssignment(): void {
    const hasTableContext = this.tableId !== null && this.tableSessionId !== null;
    const lacksTableContext = this.tableId === null && this.tableSessionId === null;

    if (this.type === OrderType.DINE_IN && !hasTableContext) {
      throw new BadRequestException('DINE_IN orders must have both tableId and tableSessionId set');
    }

    if (this.type === OrderType.TAKEAWAY && !lacksTableContext) {
      throw new BadRequestException('TAKEAWAY orders must not have tableId or tableSessionId set');
    }
  }
}
