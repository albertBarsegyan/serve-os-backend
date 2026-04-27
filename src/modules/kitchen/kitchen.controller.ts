import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KitchenService } from './kitchen.service';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';

@ApiTags('Kitchen')
@ApiBearerAuth()
@Controller('kitchen')
@UseGuards(TenantGuard)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('active-orders')
  @ApiOperation({ summary: 'Get all active orders for the kitchen display' })
  getActiveOrders(@Tenant() businessId: string) {
    return this.kitchenService.getActiveOrders(businessId);
  }
}
