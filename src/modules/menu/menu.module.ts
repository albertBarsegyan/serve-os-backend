import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Product])],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
