import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { ConfirmOrderPaymentDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { FeatureGuard } from '@common/guards/feature.guard';
import { GuestSessionGuard } from '@common/guards/guest-session.guard';
import { RequireBusinessFeature } from '@common/decorators/require-feature.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { CreateOrderFromQrDto } from './dto/create-order-from-qr.dto';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto';
import { CreateStaffOrderDto } from './dto/create-staff-order.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { RecordStaffPaymentDto } from '@modules/payments/dto/record-staff-payment.dto';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import type { ActorInfo } from '@modules/kitchen/kitchen.gateway';

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

  @Public()
  @AllowWithoutBusiness()
  @Post('guest')
  @UseGuards(GuestSessionGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Place a guest order; session validated via cookie / x-session-token' })
  @ApiResponse({ status: 201, description: 'Order created; redirectUrl present for PREPAID flow' })
  createGuestOrder(@Body() dto: CreateGuestOrderDto, @Req() req: AuthenticatedRequest) {
    return this.ordersService.createGuestOrder(req.tableSession!, dto);
  }

  @RequireBusinessFeature(
    [BusinessFeature.ORDER_DINE_IN, BusinessFeature.ORDER_TAKEAWAY, BusinessFeature.ORDER_DELIVERY],
    'any',
  )
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER)
  @Post('staff')
  @ApiOperation({ summary: 'Create an order on behalf of a customer (staff-initiated)' })
  @ApiResponse({ status: 201, description: 'Order successfully created' })
  createFromStaff(
    @Tenant(true) businessId: string,
    @Body() dto: CreateStaffOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const staffId = req.user?.type === 'staff' ? req.user.staffId : undefined;
    return this.ordersService.createFromStaff(businessId, dto, staffId);
  }

  @RequireBusinessFeature(
    [BusinessFeature.ORDER_DINE_IN, BusinessFeature.ORDER_TAKEAWAY, BusinessFeature.ORDER_DELIVERY],
    'any',
  )
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER)
  @Get()
  @ApiOperation({ summary: 'Get paginated orders for the business' })
  findAll(@Tenant(true) businessId: string, @Query() pagination: PaginationDto) {
    return this.ordersService.findAll(businessId, pagination);
  }

  @RequireBusinessFeature(
    [BusinessFeature.ORDER_DINE_IN, BusinessFeature.ORDER_TAKEAWAY, BusinessFeature.ORDER_DELIVERY],
    'any',
  )
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER)
  @Get(':id')
  @ApiOperation({ summary: 'Get an order by ID' })
  findOne(@Tenant(true) businessId: string, @Param('id') id: string) {
    return this.ordersService.findOne(businessId, id);
  }

  @RequireBusinessFeature(
    [BusinessFeature.ORDER_DINE_IN, BusinessFeature.ORDER_TAKEAWAY, BusinessFeature.ORDER_DELIVERY],
    'any',
  )
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER, StaffRole.KITCHEN)
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
    const actor = this.buildActor(req.user);
    return this.ordersService.updateStatus(businessId, id, dto, req.business?.role, actor);
  }

  private buildActor(payload: AuthenticatedRequest['user']): ActorInfo {
    if (!payload) return { type: 'system', id: 'system' };
    if (payload.type === 'owner') return { type: 'owner', id: payload.userId };
    return { type: 'staff', id: payload.staffId, role: payload.role };
  }

  /**
   * Staff fires the kitchen for an ON_PREMISE order: CREATED → CONFIRMED → IN_KITCHEN.
   * Requires WAITER, MANAGER, or OWNER. Does not apply to PREPAID orders (those
   * advance automatically when the provider confirms payment).
   */
  @RequireBusinessFeature([BusinessFeature.ORDER_DINE_IN, BusinessFeature.ORDER_TAKEAWAY], 'any')
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER)
  @Post(':id/confirm')
  @ApiOperation({ summary: 'Staff confirms an ON_PREMISE order and fires the kitchen' })
  confirmOrder(
    @Tenant(true) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const actor = this.buildActor(req.user);
    return this.ordersService.confirmOrder(businessId, id, actor);
  }

  /**
   * Staff records a payment against an order (CASHIER / MANAGER / OWNER).
   * Recomputes paymentStatus from SUM(confirmed); closes the order if fully paid.
   */
  @RequireBusinessFeature(
    [BusinessFeature.ORDER_DINE_IN, BusinessFeature.ORDER_TAKEAWAY, BusinessFeature.ORDER_DELIVERY],
    'any',
  )
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.CASHIER)
  @Post(':id/payments')
  @ApiOperation({ summary: 'Record a staff-collected payment and recompute order payment status' })
  recordStaffPayment(
    @Tenant(true) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordStaffPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const staffId = req.user?.type === 'staff' ? req.user.staffId : null;
    return this.ordersService.recordStaffPayment(businessId, id, dto, staffId);
  }

  /**
   * Cashier confirms the pending payment opened when an order was served.
   * Transitions DELIVERED → CLOSED and broadcasts 'order:paid'.
   * If posAutoAcceptPayment is enabled on the business, this fires automatically
   * and the cashier queue stays empty.
   */
  @RequireBusinessFeature(
    [BusinessFeature.ORDER_DINE_IN, BusinessFeature.ORDER_TAKEAWAY, BusinessFeature.ORDER_DELIVERY],
    'any',
  )
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.CASHIER)
  @Post(':id/payment/confirm')
  @ApiOperation({ summary: 'Cashier confirms payment for a served order (DELIVERED → CLOSED)' })
  @ApiResponse({ status: 200, description: 'Payment confirmed; order closed' })
  @ApiResponse({ status: 400, description: 'Order not in DELIVERED status' })
  @ApiResponse({ status: 404, description: 'No pending payment found' })
  confirmOrderPayment(
    @Tenant(true) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmOrderPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const staffId = req.user?.type === 'staff' ? req.user.staffId : null;
    return this.ordersService.confirmOrderPayment(businessId, id, staffId, dto);
  }

  @Public()
  @AllowWithoutBusiness()
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Customer cancels their own CREATED order via session token' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 400, description: 'Order is past the cancellable state' })
  @ApiResponse({ status: 403, description: 'Session does not own this order' })
  cancelBySession(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-session-token') sessionToken: string,
  ) {
    return this.ordersService.cancelBySession(id, sessionToken);
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
