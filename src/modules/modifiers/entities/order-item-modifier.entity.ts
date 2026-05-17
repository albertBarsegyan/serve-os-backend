import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { OrderItem } from '@modules/orders/entities/order-item.entity';
import { Modifier } from './modifier.entity';

@Entity('order_item_modifiers')
export class OrderItemModifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderItemId: string;

  @ManyToOne(() => OrderItem, (oi) => oi.selectedModifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItem;

  @Column()
  modifierId: string;

  @ManyToOne(() => Modifier, (m) => m.orderItemModifiers)
  @JoinColumn({ name: 'modifierId' })
  modifier: Modifier;

  @Column()
  modifierName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceAdjustment: number;

  @CreateDateColumn()
  createdAt: Date;
}
