import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from './staff.entity';
import { StaffRole } from '@common/enums/staff-role.enum';

@Entity('staff_invites')
export class StaffInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  invitedBy: string;

  @ManyToOne(() => Staff, (s) => s.sentInvites)
  @JoinColumn({ name: 'invitedBy' })
  inviter: Staff;

  @Column()
  email: string;

  @Column({ type: 'enum', enum: StaffRole, enumName: 'staff_role_enum' })
  role: StaffRole;

  @Column({ unique: true })
  @Index()
  token: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  isAccepted: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
