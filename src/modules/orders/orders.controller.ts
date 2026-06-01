import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Headers,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/orders.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { FeatureGuard } from '@common/guards/feature.guard';
import { RequireBusinessFeature } from '@common/decorators/require-feature.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { CreateOrderFromQrDto } from './dto/create-order-from-qr.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(TenantGuard, FeatureGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Public()
  @AllowWithoutBusiness()
  @Post()
  @ApiOperation({ summary: 'Place a new QR order using session token' })
  @ApiResponse({ status: 201, description: 'Order successfully placed' })
  createFromQr(
    @Body() dto: CreateOrderFromQrDto,
    @Headers('x-session-token') headerSessionToken?: string,
  ) {
    return this.ordersService.createFromQr(dto, headerSessionToken);
  }

  @RequireBusinessFeature(
    BusinessFeature.ORDER_DINE_IN,
    BusinessFeature.ORDER_TAKEAWAY,
    BusinessFeature.ORDER_DELIVERY,
  )
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER)
  @Get()
  @ApiOperation({ summary: 'Get all orders for the business' })
  findAll(@Tenant(true) businessId: string) {
    return this.ordersService.findAll(businessId);
  }

  @RequireBusinessFeature(
    BusinessFeature.ORDER_DINE_IN,
    BusinessFeature.ORDER_TAKEAWAY,
    BusinessFeature.ORDER_DELIVERY,
  )
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER)
  @Get(':id')
  @ApiOperation({ summary: 'Get an order by ID' })
  findOne(@Tenant(true) businessId: string, @Param('id') id: string) {
    return this.ordersService.findOne(businessId, id);
  }

  @RequireBusinessFeature(
    BusinessFeature.ORDER_DINE_IN,
    BusinessFeature.ORDER_TAKEAWAY,
    BusinessFeature.ORDER_DELIVERY,
  )
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  updateStatus(
    @Tenant(true) businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.updateStatus(businessId, id, dto, req.business?.role);
  }

  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER)
  @Post(':id/payment/cash')
  processCashPayment(
    @Tenant(true) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessPaymentDto,
  ) {
    return this.ordersService.processCashPayment(businessId, id, dto);
  }

  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER)
  @Post(':id/payment/pos')
  processPosPayment(
    @Tenant(true) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessPaymentDto,
  ) {
    return this.ordersService.processPosPayment(businessId, id, dto);
  }
}
