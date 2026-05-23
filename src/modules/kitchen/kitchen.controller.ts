import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KitchenService } from './kitchen.service';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { FeatureGuard } from '@common/guards/feature.guard';
import { RequireBusinessFeature } from '@common/decorators/require-feature.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { Role } from '@common/enums/role.enum';

@ApiTags('Kitchen')
@ApiBearerAuth()
@Controller('kitchen')
@UseGuards(TenantGuard, FeatureGuard)
@RequireBusinessFeature(BusinessFeature.KITCHEN)
@Roles(Role.OWNER, Role.ADMIN, Role.CHEF)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('active-orders')
  @ApiOperation({ summary: 'Get all active orders for the kitchen display' })
  getActiveOrders(@Tenant(true) businessId: string) {
    return this.kitchenService.getActiveOrders(businessId);
  }
}
