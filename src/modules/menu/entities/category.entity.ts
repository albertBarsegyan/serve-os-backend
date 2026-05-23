import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { Product } from './product.entity';
import { KitchenStation } from '@modules/kitchen/entities/kitchen-station.entity';

@Entity('menu_categories')
export class MenuCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business, (b) => b.menuCategories)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  // ── ADD THESE TWO ──
  @Column({ nullable: true })
  kitchenStationId: string;

  @ManyToOne(() => KitchenStation, (k) => k.menuCategories, { nullable: true })
  @JoinColumn({ name: 'kitchenStationId' })
  kitchenStation: KitchenStation;

  @Column()
  name: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
