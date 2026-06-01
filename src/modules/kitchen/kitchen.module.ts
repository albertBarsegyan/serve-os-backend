import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenGateway } from './kitchen.gateway';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';
import { Order } from '@modules/orders/entities/order.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { KitchenStation } from '@modules/kitchen/entities/kitchen-station.entity';
import { TenantAccessService } from '@common/guards/tenant-access.service';
import { PermissionGuard } from '@common/guards/permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Order, KitchenStation, Business, Staff])],
  providers: [TenantAccessService, KitchenGateway, KitchenService, PermissionGuard],
  controllers: [KitchenController],
  exports: [KitchenGateway],
})
export class KitchenModule {}
