import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableSessionsController } from './table-sessions.controller';
import { TableSessionsService } from './table-sessions.service';
import { GuestSessionGuard } from '@common/guards/guest-session.guard';
import { TableSessionGuard } from '@common/guards/table-session.guard';
import { TipRateLimitGuard } from '@common/guards/tip-rate-limit.guard';
import { TableSession } from './table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { TenantAccessService } from '@common/guards/tenant-access.service';
import { FeatureGuard } from '@common/guards/feature.guard';
import { KitchenModule } from '@modules/kitchen/kitchen.module';

@Module({
  imports: [TypeOrmModule.forFeature([TableSession, Table, Business, Order, Staff]), KitchenModule],
  controllers: [TableSessionsController],
  providers: [
    TableSessionsService,
    GuestSessionGuard,
    TableSessionGuard,
    TipRateLimitGuard,
    FeatureGuard,
    TenantAccessService,
  ],
  exports: [TableSessionsService, GuestSessionGuard],
})
export class TableSessionsModule {}
