import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { Modifier } from './modifier.entity';
import { Product } from '@modules/menu/entities/product.entity';
import { ModifierSelectionType } from '@common/enums/modifier.enum';

@Entity('modifier_groups')
export class ModifierGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enumName: 'modifier_selection_type_enum',
    enum: ModifierSelectionType,
    default: ModifierSelectionType.SINGLE,
  })
  selectionType: ModifierSelectionType;

  @Column({ default: false })
  isRequired: boolean;

  @Column({ default: 1 })
  minSelections: number;

  @Column({ nullable: true })
  maxSelections: number;

  @Column({ default: 0 })
  position: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Modifier, (m) => m.group, { cascade: ['insert', 'update'] })
  modifiers: Modifier[];

  @ManyToMany(() => Product, (p) => p.modifierGroups)
  products: Product[];
}
