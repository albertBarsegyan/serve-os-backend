import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ModifierGroup } from './modifier-group.entity';
import { OrderItemModifier } from './order-item-modifier.entity';

@Entity('modifiers')
export class Modifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  groupId: string;

  @ManyToOne(() => ModifierGroup, (g) => g.modifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: ModifierGroup;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceAdjustment: number;

  @Column({ default: 'adjustment' })
  priceType: string;

  @Column({ default: 0 })
  position: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OrderItemModifier, (oim) => oim.modifier)
  orderItemModifiers: OrderItemModifier[];
}
