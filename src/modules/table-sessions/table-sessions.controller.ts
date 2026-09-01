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
  async create(@Body() dto: ScanSessionDto, @Res({ passthrough: true }) res: express.Response) {
    const result = await this.tableSessionsService.scan(dto.qrCode);
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
  async scan(@Body() dto: ScanSessionDto, @Res({ passthrough: true }) res: express.Response) {
    const result = await this.tableSessionsService.scan(dto.qrCode);
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
    const token =
      (req.cookies as Record<string, string> | undefined)?.['customer_session_token'] ??
      headerToken;
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
    const token =
      (req.cookies as Record<string, string> | undefined)?.['customer_session_token'] ??
      headerToken;
    if (!token) {
      throw new NotFoundException('No session token provided');
    }
    return this.tableSessionsService.resumeByToken(token);
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

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER)
  @Post(':id/close')
  @ApiOperation({ summary: 'Close table session when all orders are settled' })
  close(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.tableSessionsService.closeSession(id, req.user);
  }
}
