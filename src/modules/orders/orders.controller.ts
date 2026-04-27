import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(TenantGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Place a new order (Guest or Staff)' })
  @ApiResponse({ status: 201, description: 'Order successfully placed' })
  create(@Tenant() businessId: string, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(businessId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders for the business' })
  findAll(@Tenant() businessId: string) {
    return this.ordersService.findAll(businessId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order by ID' })
  findOne(@Tenant() businessId: string, @Param('id') id: string) {
    return this.ordersService.findOne(businessId, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  updateStatus(
    @Tenant() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(businessId, id, dto);
  }
}
