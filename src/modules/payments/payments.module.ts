import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentReconcileService } from './services/payment-reconcile.service';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { OrdersModule } from '@modules/orders/orders.module';
import { TenantAccessService } from '@common/guards/tenant-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentAllocation, Order, Business, Staff]),
    OrdersModule,
  ],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, PaymentReconcileService, TenantAccessService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
