import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { TableSessionsService } from './table-sessions.service';
import { ScanSessionDto } from './dto/scan-session.dto';
import { TenantGuard } from '@common/guards/tenant.guard';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import { Req } from '@nestjs/common/decorators/http/route-params.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';

@ApiTags('Table Sessions')
@Controller('sessions')
export class TableSessionsController {
  constructor(private readonly tableSessionsService: TableSessionsService) {}

  @Public()
  @AllowWithoutBusiness()
  @Post('scan')
  @ApiOperation({ summary: 'Scan QR and create/rejoin active table session' })
  scan(@Body() dto: ScanSessionDto) {
    return this.tableSessionsService.scan(dto.qrCode);
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
