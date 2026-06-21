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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import * as express from 'express';
import { Public } from '@common/decorators/public.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { TableSessionsService } from './table-sessions.service';
import { ScanSessionDto } from './dto/scan-session.dto';
import { TenantGuard } from '@common/guards/tenant.guard';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';

const SESSION_COOKIE_MAX_AGE = 28800 * 1000; // 8 hours in ms
const SESSION_THROTTLE = { default: { limit: 20, ttl: 60000 } };

@ApiTags('Table Sessions')
@Controller('sessions')
export class TableSessionsController {
  constructor(private readonly tableSessionsService: TableSessionsService) {}

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

  private setSessionCookies(res: express.Response, sessionToken: string, businessId: string) {
    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE,
    };
    res.cookie('customer_session_token', sessionToken, cookieOpts);
    res.cookie('business_id', businessId, cookieOpts);
  }

  @Public()
  @AllowWithoutBusiness()
  @Get(':sessionId/bill')
  @ApiOperation({ summary: 'Get split bill grouped by session token' })
  getBill(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.tableSessionsService.getBillBySession(sessionId);
  }

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER)
  @Post(':id/close')
  @ApiOperation({ summary: 'Close table session when all orders are settled' })
  close(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.tableSessionsService.closeSession(id, req?.authPayload);
  }
}
