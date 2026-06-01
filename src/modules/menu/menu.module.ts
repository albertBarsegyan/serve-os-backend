import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuCategory } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { ModifierGroup } from '@modules/modifiers/entities/modifier-group.entity';
import { Modifier } from '@modules/modifiers/entities/modifier.entity';
import { OrderItemModifier } from '@modules/modifiers/entities/order-item-modifier.entity';
import { TenantAccessService } from '@common/guards/tenant-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MenuCategory,
      ModifierGroup,
      Modifier,
      OrderItemModifier,
      Product,
      ProductVariant,
      Business,
      Staff,
    ]),
  ],
  controllers: [MenuController],
  providers: [TenantAccessService, MenuService],
  exports: [MenuService],
})
export class MenuModule {}
