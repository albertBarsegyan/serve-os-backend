import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Product } from '@modules/menu/entities/product.entity';
import { KitchenModule } from '@modules/kitchen/kitchen.module';
import { Business } from '@modules/business/entities/business.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product, Business]), KitchenModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
