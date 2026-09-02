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
// A table can now have several concurrently-active sessions (separate guest parties at
// the same table) — see mergedIntoSessionId below for how staff combine them into one bill.
@Index('IDX_table_sessions_active_table', ['tableId'])
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

  // Staff-initiated "join": when a table has multiple concurrent sessions (e.g. a large
  // table where guests scanned separately) and they want one combined bill, this points at
  // the session they're merged into. Orders keep their original tableSessionId untouched —
  // nothing about which session/guest actually placed an order is ever rewritten — this is
  // purely a billing-group label the admin UI and payment summaries read. Null means
  // "stands on its own," which is also true for a session other sessions point into.
  @Column({ nullable: true })
  mergedIntoSessionId: string | null;

  @ManyToOne(() => TableSession)
  @JoinColumn({ name: 'mergedIntoSessionId' })
  mergedInto: TableSession | null;

  // Set by KitchenGateway.handleCallWaiter, cleared by TableSessionsService.acknowledgeWaiterCall
  // — persisted (not just broadcast over the socket) so a staff client that was offline or
  // opens the tables page after the call was raised still sees it, and so an acknowledgement
  // from one device is visible to every other staff device rather than only the one that
  // pressed it.
  @Column({ default: false, type: 'boolean' })
  waiterCallActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  waiterCallAt: Date | null;

  @OneToMany(() => Order, (o) => o.tableSession)
  orders: Order[];
}
