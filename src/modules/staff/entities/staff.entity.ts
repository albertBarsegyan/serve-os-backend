import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { User } from '@modules/users/entities/user.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { Payment } from '@modules/payments/entities/payment.entity';
import { StaffInvite } from '@modules/staff/entities/staff-invite.entity';
import { StaffRole } from '@common/enums/staff-role.enum';

@Entity('staff')
@Unique(['userId', 'businessId'])
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: StaffRole,
    enumName: 'staff_role_enum',
    default: StaffRole.WAITER,
  })
  role: StaffRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Order, (o) => o.waiter)
  servedOrders: Order[];

  @OneToMany(() => Payment, (p) => p.confirmedByStaff)
  confirmedPayments: Payment[];

  @OneToMany(() => StaffInvite, (i) => i.inviter)
  sentInvites: StaffInvite[];
}
