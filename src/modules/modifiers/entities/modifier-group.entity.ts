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
  DeleteDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
  Check,
} from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { Business } from '@modules/business/entities/business.entity';
import { Modifier } from './modifier.entity';
import { Product } from '@modules/menu/entities/product.entity';
import { ModifierSelectionType } from '@common/enums/modifier.enum';

@Entity('modifier_groups')
@Check(`"isRequired" = false OR "minSelections" >= 1`)
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
    type: 'text',
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

  @DeleteDateColumn()
  @Index()
  deletedAt: Date | null;

  @OneToMany(() => Modifier, (m) => m.group, { cascade: ['insert', 'update'] })
  modifiers: Modifier[];

  @ManyToMany(() => Product, (p) => p.modifierGroups)
  products: Product[];

  @BeforeInsert()
  @BeforeUpdate()
  validateSelectionRules(): void {
    if (this.isRequired && this.minSelections < 1) {
      throw new BadRequestException('A required modifier group must have minSelections >= 1');
    }

    if (!this.isRequired && this.minSelections > 0) {
      // Normalize to required rather than rejecting valid positive minimums.
      this.isRequired = true;
    }
  }
}
