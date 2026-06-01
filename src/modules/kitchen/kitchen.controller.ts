import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KitchenService } from './kitchen.service';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';

@ApiTags('Kitchen')
@ApiBearerAuth()
@Controller('kitchen')
@UseGuards(TenantGuard, PermissionGuard)
@Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.KITCHEN)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @RequirePermission(BusinessFeature.KITCHEN, 'read')
  @Get('active-orders')
  @ApiOperation({ summary: 'Get all active orders for the kitchen display' })
  getActiveOrders(@Tenant(true) businessId: string) {
    return this.kitchenService.getActiveOrders(businessId);
  }
}
