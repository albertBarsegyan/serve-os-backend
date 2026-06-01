import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Product } from '@modules/menu/entities/product.entity';
import { KitchenModule } from '@modules/kitchen/kitchen.module';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { Payment } from '@modules/payments/entities/payment.entity';
import { TableSessionsModule } from '@modules/table-sessions/table-sessions.module';
import { OrderTransitionService } from './order-transition.service';
import { TenantAccessService } from '@common/guards/tenant-access.service';
import { FeatureGuard } from '@common/guards/feature.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, Business, Staff, Payment]),
    KitchenModule,
    TableSessionsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderTransitionService, TenantAccessService, FeatureGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
