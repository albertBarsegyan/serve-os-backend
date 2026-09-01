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

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true, type: 'text' })
  @Exclude()
  emailVerificationToken: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  emailVerificationExpiresAt: Date | null;

  @Column({ nullable: true, type: 'text' })
  @Exclude()
  refreshToken: string | null;

  // Holds the immediately-superseded refresh token hash for a short grace window after
  // rotation, so a second request racing on the same pre-rotation cookie (e.g. two tabs
  // refreshing at once) isn't mistaken for reuse of a stolen token. See auth.service.ts.
  @Column({ nullable: true, type: 'text' })
  @Exclude()
  previousRefreshToken: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  @Exclude()
  refreshTokenRotatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
