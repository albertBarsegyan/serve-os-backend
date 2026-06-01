import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Business } from '@modules/business/entities/business.entity';
import { User } from '@modules/users/entities/user.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { Payment } from '@modules/payments/entities/payment.entity';
import { StaffRole } from '@common/enums/staff-role.enum';
import { StaffAuthType } from '@common/enums/staff-auth-type.enum';
import { BusinessFeature } from '@common/enums/business-feature.enum';

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  createdByOwnerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByOwnerId' })
  createdByOwner: User;

  @Column()
  displayName: string;

  @Column({
    type: 'text',
    enum: StaffRole,
  })
  role: StaffRole;

  @Column({
    type: 'text',
    enum: StaffAuthType,
  })
  authType: StaffAuthType;

  @Column({ nullable: true, type: 'text' })
  @Exclude()
  pin: string | null; // bcrypt hashed 4-digit PIN

  @Column({ nullable: true, type: 'text' })
  @Exclude()
  passwordHash: string | null; // only for MANAGER+ roles

  @Column({ nullable: true, type: 'text' })
  email: string | null; // only for invite flow

  @Column({ nullable: true, type: 'text' })
  @Exclude()
  inviteToken: string | null; // UUID token

  @Column({ nullable: true, type: 'timestamp' })
  inviteExpiresAt: Date | null;

  @Column({ default: false })
  mustChangePassword: boolean; // force password change on first login

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  featureOverrides: Partial<Record<BusinessFeature, boolean>> | null;

  @DeleteDateColumn()
  @Index()
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Order, (o) => o.waiter)
  servedOrders: Order[];

  @OneToMany(() => Payment, (p) => p.confirmedBy)
  confirmedPayments: Payment[];
}
