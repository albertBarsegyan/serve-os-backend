import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuCategory } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MenuCategory, Product, Business, Staff])],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
