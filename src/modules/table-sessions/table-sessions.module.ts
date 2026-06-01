import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableSessionsController } from './table-sessions.controller';
import { TableSessionsService } from './table-sessions.service';
import { TableSession } from './table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { TenantAccessService } from '@common/guards/tenant-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([TableSession, Table, Business, Order, Staff])],
  controllers: [TableSessionsController],
  providers: [TableSessionsService, TenantAccessService],
  exports: [TableSessionsService],
})
export class TableSessionsModule {}
