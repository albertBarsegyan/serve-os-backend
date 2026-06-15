import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Table } from './entities/table.entity';
import { TableSession } from '@modules/table-sessions/table-session.entity';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { TenantAccessService } from '@common/guards/tenant-access.service';
import { ImagesModule } from '@modules/images/images.module';

@Module({
  imports: [TypeOrmModule.forFeature([Table, TableSession, Business, Staff]), ImagesModule],
  controllers: [TablesController],
  providers: [TenantAccessService, TablesService],
  exports: [TablesService],
})
export class TablesModule {}
