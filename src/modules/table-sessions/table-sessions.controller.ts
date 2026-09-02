import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { Public } from '@common/decorators/public.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { TableSessionsService } from './table-sessions.service';
import { ScanSessionDto } from './dto/scan-session.dto';
import { CreateTipDto, TipResponseDto } from './dto/create-tip.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { TenantGuard } from '@common/guards/tenant.guard';
import { TableSessionGuard } from '@common/guards/table-session.guard';
import { TipRateLimitGuard } from '@common/guards/tip-rate-limit.guard';
import { FeatureGuard } from '@common/guards/feature.guard';
import { Tenant } from '@common/decorators/tenant.decorator';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { RequireBusinessFeature } from '@common/decorators/require-feature.decorator';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { setBusinessCookie } from '@common/utils/business.utils';

const SESSION_COOKIE_MAX_AGE = 28800 * 1000; // 8 hours in ms
const SESSION_THROTTLE = { default: { limit: 20, ttl: 60000 } };
const TIP_THROTTLE = { default: { limit: 10, ttl: 60000 } };

@ApiTags('Table Sessions')
@Controller('sessions')
export class TableSessionsController {
  constructor(
    private readonly tableSessionsService: TableSessionsService,
    private readonly configService: ConfigService,
  ) {}

  /** Primary guest session creation endpoint used by the QR flow. */
  @Public()
  @AllowWithoutBusiness()
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle(SESSION_THROTTLE)
  @ApiOperation({ summary: 'Create or rejoin a guest session by QR code' })
  async create(
    @Body() dto: ScanSessionDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
    @Headers('x-session-token') headerToken?: string,
  ) {
    const result = await this.tableSessionsService.scan(
      dto.qrCode,
      this.readSessionToken(req, headerToken),
    );
    this.setSessionCookies(res, result.sessionToken, result.businessId);
    return result;
  }

  /** Legacy alias kept for backward compatibility. */
  @Public()
  @AllowWithoutBusiness()
  @Post('scan')
  @UseGuards(ThrottlerGuard)
  @Throttle(SESSION_THROTTLE)
  @ApiOperation({ summary: 'Scan QR and create/rejoin active table session' })
  async scan(
    @Body() dto: ScanSessionDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
    @Headers('x-session-token') headerToken?: string,
  ) {
    const result = await this.tableSessionsService.scan(
      dto.qrCode,
      this.readSessionToken(req, headerToken),
    );
    this.setSessionCookies(res, result.sessionToken, result.businessId);
    return result;
  }

  /**
   * Returns the active session for the current request — mirrors GET /auth/me
   * so the frontend can bootstrap guest context the same way it bootstraps auth context.
   */
  @Public()
  @AllowWithoutBusiness()
  @Get('current')
  @ApiOperation({ summary: 'Get active guest session from cookie (mirrors /auth/me)' })
  current(@Req() req: express.Request, @Headers('x-session-token') headerToken?: string) {
    const token = this.readSessionToken(req, headerToken);
    if (!token) {
      throw new NotFoundException('No session token provided');
    }
    return this.tableSessionsService.resumeByToken(token);
  }

  @Public()
  @AllowWithoutBusiness()
  @Get('resume')
  @ApiOperation({ summary: 'Resume an existing session from the stored cookie or token header' })
  resume(@Req() req: express.Request, @Headers('x-session-token') headerToken?: string) {
    const token = this.readSessionToken(req, headerToken);
    if (!token) {
      throw new NotFoundException('No session token provided');
    }
    return this.tableSessionsService.resumeByToken(token);
  }

  /**
   * Guest fallback for the order-tracking view: when the client's local record for the
   * session's most recent order is missing (storage cleared, or a QR re-scan opened a
   * context that never had it), this rebuilds a receipt from the still-active session's
   * most recent order server-side rather than leaving the guest stuck on the plain menu.
   */
  @Public()
  @AllowWithoutBusiness()
  @Get(':sessionToken/recent-order')
  @ApiOperation({ summary: "Guest fallback: recover the session's most recent order" })
  @ApiResponse({ status: 404, description: 'No order found for this session' })
  async recentOrder(@Param('sessionToken') sessionToken: string) {
    const session = await this.tableSessionsService.getActiveByToken(sessionToken);
    const order = await this.tableSessionsService.getRecentOrderDetailForSession(session.id);
    if (!order) {
      throw new NotFoundException('No order found for this session');
    }

    return {
      orderId: order.id,
      items: order.items.map((item) => ({
        name: item.product?.name ?? 'Item',
        qty: item.quantity,
        price: Number(item.unitPrice) * item.quantity,
      })),
      total: Number(order.totalAmount),
      tableNumber: order.table ? `Table ${order.table.number}` : '',
      placedAt: order.createdAt.getTime(),
      paymentMethod: 'ONLINE',
    };
  }

  /**
   * Guest self-service tip. The path's :sessionToken is the auth capability — TableSessionGuard
   * validates it, asserts the session is open, and resolves req.businessId + req.order (the
   * session's most-recently-updated order). @Public() only disables JWT auth; TableSessionGuard
   * is the actual authorization here.
   */
  @Public()
  @AllowWithoutBusiness()
  @UseGuards(TableSessionGuard, FeatureGuard, ThrottlerGuard, TipRateLimitGuard)
  @RequireBusinessFeature([BusinessFeature.TIPS])
  @Throttle(TIP_THROTTLE)
  @Post(':sessionToken/tip')
  @ApiParam({ name: 'sessionToken', description: 'The guest session token (path, not body)' })
  @ApiOperation({ summary: 'Guest adds a tip to their session order' })
  @ApiResponse({ status: 201, description: 'Tip recorded', type: TipResponseDto })
  @ApiResponse({ status: 403, description: 'Session does not own this order, or TIPS disabled' })
  @ApiResponse({ status: 409, description: 'Order is no longer eligible for a tip' })
  createTip(
    @Param('sessionToken') _sessionToken: string,
    @Body() dto: CreateTipDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<TipResponseDto> {
    return this.tableSessionsService.createTip(req.tableSession!, req.order!, dto);
  }

  private readSessionToken(req: express.Request, headerToken?: string): string | undefined {
    return (
      (req.cookies as Record<string, string> | undefined)?.['customer_session_token'] ?? headerToken
    );
  }

  private setSessionCookies(res: express.Response, sessionToken: string, businessId: string) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie('customer_session_token', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE,
    });

    setBusinessCookie({
      res,
      businessId,
      isProduction,
      domain: this.configService.get<string>('COOKIE_DOMAIN'),
      maxAge: SESSION_COOKIE_MAX_AGE,
    });
  }

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER)
  @Get(':sessionId/bill')
  @ApiOperation({ summary: 'Get split bill grouped by session token (staff/owner only)' })
  getBill(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Tenant(true) businessId: string) {
    return this.tableSessionsService.getBillBySession(sessionId, businessId);
  }

  /**
   * Every active session across the business, for the admin Tables view — a table can now
   * carry several concurrent sessions (separate guest parties), so the frontend groups
   * these (and the orders/payments it already fetches separately) by tableId client-side.
   * Deliberately omits sessionToken: it's the guest's own bearer credential, and staff have
   * no need to see (let alone reuse) it.
   */
  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER)
  @Get()
  @ApiOperation({ summary: 'List every active session for the business (staff/owner only)' })
  async list(@Tenant(true) businessId: string) {
    const sessions = await this.tableSessionsService.getActiveSessionsForBusiness(businessId);
    return sessions.map((s) => ({
      id: s.id,
      tableId: s.tableId,
      businessId: s.businessId,
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      openedAt: s.openedAt,
      expiresAt: s.expiresAt,
      mergedIntoSessionId: s.mergedIntoSessionId,
      waiterCallActive: s.waiterCallActive,
      waiterCallAt: s.waiterCallAt,
    }));
  }

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER)
  @Post(':id/close')
  @ApiOperation({ summary: 'Close table session when all orders are settled' })
  close(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.tableSessionsService.closeSession(id, req.user);
  }

  /** Marks two sessions at the same table as billed together — see TableSession.mergedIntoSessionId. */
  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER)
  @Post(':id/join')
  @ApiOperation({
    summary: 'Join another session at the same table into this one for combined billing',
  })
  join(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JoinSessionDto,
    @Tenant(true) businessId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tableSessionsService.joinSessions(businessId, id, dto, req.user);
  }

  /** Reverses a join — the session goes back to being billed on its own. */
  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER)
  @Post(':id/split')
  @ApiOperation({ summary: 'Detach a session from whatever billing group it was joined into' })
  split(
    @Param('id', ParseUUIDPipe) id: string,
    @Tenant(true) businessId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tableSessionsService.splitSession(businessId, id, req.user);
  }

  /** Clears a waiter call raised via the guest's call-waiter socket message — visible to
   * every staff device via the order:waiter-acknowledged broadcast, not just this one. */
  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER)
  @Post(':id/waiter-acknowledge')
  @ApiOperation({ summary: 'Acknowledge (clear) a raised waiter call for this session' })
  acknowledgeWaiter(
    @Param('id', ParseUUIDPipe) id: string,
    @Tenant(true) businessId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tableSessionsService.acknowledgeWaiterCall(businessId, id, req.user);
  }
}
