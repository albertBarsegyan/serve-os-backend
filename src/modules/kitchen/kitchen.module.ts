import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenGateway } from './kitchen.gateway';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';
import { Order } from '@modules/orders/entities/order.entity';
import { Business } from '@modules/business/entities/business.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Business])],
  providers: [KitchenGateway, KitchenService],
  controllers: [KitchenController],
  exports: [KitchenGateway],
})
export class KitchenModule {}
