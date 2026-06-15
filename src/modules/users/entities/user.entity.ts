import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from '@common/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({
    type: 'text',
    default: Role.OWNER,
  })
  role: Role;

  @Column({ type: 'text', nullable: true, default: null })
  avatarUrl: string | null;

  @Column({ default: false })
  hasBusiness: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, type: 'text' })
  @Exclude()
  refreshToken: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
