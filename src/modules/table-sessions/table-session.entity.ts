import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Table } from '@modules/tables/entities/table.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';

@Entity('table_sessions')
// Guards against two concurrent QR scans both winning a check-then-insert race
// and opening two active sessions for the same table.
@Index('IDX_table_sessions_active_table', ['tableId'], {
  unique: true,
  where: '"isActive" = true',
})
export class TableSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tableId: string;

  @ManyToOne(() => Table)
  @JoinColumn({ name: 'tableId' })
  table: Table;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column({ unique: true })
  sessionToken: string;

  @Column({ nullable: true, type: 'text' })
  customerName: string | null;

  @Column({ nullable: true, type: 'text' })
  customerPhone: string | null;

  @Column({ default: true, type: 'boolean' })
  isActive: boolean;

  @CreateDateColumn()
  openedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @OneToMany(() => Order, (o) => o.tableSession)
  orders: Order[];
}
