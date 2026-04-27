import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { User } from '@modules/users/entities/user.entity';

export enum StaffRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  WAITER = 'WAITER',
  CHEF = 'CHEF',
}

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
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: StaffRole,
    default: StaffRole.WAITER,
  })
  role: StaffRole;
}
