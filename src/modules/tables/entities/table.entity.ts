import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { TableSession } from '@modules/table-sessions/table-session.entity';

@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  number: number;

  @Column({ unique: true })
  qrCode: string;

  @Column()
  capacity: number;

  @Column({ default: true })
  isActive: boolean;

  @DeleteDateColumn()
  @Index()
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Order, (o) => o.table)
  orders: Order[];

  @OneToMany(() => TableSession, (s) => s.table)
  tableSessions: TableSession[];
}
