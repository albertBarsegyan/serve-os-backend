import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { OrdersModule } from '@modules/orders/orders.module';
import { TenantAccessService } from '@common/guards/tenant-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Order, Business, Staff]), OrdersModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, TenantAccessService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
