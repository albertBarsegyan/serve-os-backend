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

@ApiTags('Table Sessions')
@Controller('sessions')
export class TableSessionsController {
  constructor(private readonly tableSessionsService: TableSessionsService) {}

  @Public()
  @AllowWithoutBusiness()
  @Post('scan')
  @ApiOperation({ summary: 'Scan QR and create/rejoin active table session' })
  async scan(
    @Body() dto: ScanSessionDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.tableSessionsService.scan(dto.qrCode);

    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE,
    };
    res.cookie('customer_session_token', result.sessionToken, cookieOpts);
    // Set business_id so TenantMiddleware can resolve tenant context without a DB lookup
    res.cookie('business_id', result.businessId, cookieOpts);

    return result;
  }

  @Public()
  @AllowWithoutBusiness()
  @Get('resume')
  @ApiOperation({ summary: 'Resume an existing session from the stored cookie or token header' })
  resume(
    @Req() req: express.Request,
    @Headers('x-session-token') headerToken?: string,
  ) {
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
