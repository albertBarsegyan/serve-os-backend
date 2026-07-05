import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';

@Entity('displays')
export class Display {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  name: string;

  @Column({ unique: true })
  tokenHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true, default: null })
  revokedAt: Date | null;
}
