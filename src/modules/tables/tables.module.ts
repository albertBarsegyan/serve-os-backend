import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Table } from './entities/table.entity';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { TenantAccessService } from '@common/guards/tenant-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([Table, Business, Staff])],
  controllers: [TablesController],
  providers: [TenantAccessService, TablesService],
  exports: [TablesService],
})
export class TablesModule {}
