import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';

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
}
