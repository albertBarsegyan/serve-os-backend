import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BusinessType {
  RESTAURANT = 'RESTAURANT',
  CAFE = 'CAFE',
  BAR = 'BAR',
}

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: BusinessType,
    default: BusinessType.RESTAURANT,
  })
  type: BusinessType;

  @Column()
  location: string;

  @Column()
  currency: string;

  @Column({ type: 'jsonb', nullable: true })
  workingHours: any;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
