import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Order } from './order.entity';
import { Product } from '@modules/menu/entities/product.entity';
import { OrderItemModifier } from '@modules/modifiers/entities/order-item-modifier.entity';
import { KitchenStation } from '@modules/kitchen/entities/kitchen-station.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => OrderItemModifier, (oim) => oim.orderItem, { cascade: ['insert', 'update'] })
  selectedModifiers: OrderItemModifier[];

  @Column({ nullable: true })
  kitchenStationId: string;

  @ManyToOne(() => KitchenStation, (k) => k.orderItems, { nullable: true })
  @JoinColumn({ name: 'kitchenStationId' })
  kitchenStation: KitchenStation;
}
