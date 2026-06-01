import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { TenantGuard } from '@common/guards/tenant.guard';
import { TenantAccessService } from '@common/guards/tenant-access.service';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [TypeOrmModule.forFeature([Business, Staff])],
  providers: [
    TenantAccessService,
    TenantGuard,
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
  ],
  exports: [TenantGuard, TenantAccessService],
})
export class TenantModule {}
