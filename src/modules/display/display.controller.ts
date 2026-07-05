import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DisplayService } from './display.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { UnifiedAuthGuard } from '@modules/auth/guards/unified-auth.guard';
import { GetAuthPayload } from '@modules/auth/decorators/auth-payload.decorator';
import type { AuthPayload } from '@modules/auth/types/auth-payload.type';

@ApiTags('Displays')
@ApiBearerAuth()
@Roles(Role.OWNER, StaffRole.MANAGER)
@UseGuards(UnifiedAuthGuard)
@Controller('business/:businessId/displays')
export class DisplayController {
  constructor(private readonly displayService: DisplayService) {}

  @Post()
  @ApiOperation({ summary: 'Create a venue TV display and return its one-time access URL' })
  create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateDisplayDto,
    @GetAuthPayload() authPayload: AuthPayload,
  ) {
    return this.displayService.create(businessId, dto, authPayload);
  }

  @Get()
  @ApiOperation({ summary: 'List displays for a business' })
  findAll(@Param('businessId') businessId: string, @GetAuthPayload() authPayload: AuthPayload) {
    return this.displayService.findAll(businessId, authPayload);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Rotate a display token, returning a new one-time access URL' })
  regenerate(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @GetAuthPayload() authPayload: AuthPayload,
  ) {
    return this.displayService.regenerate(businessId, id, authPayload);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a display' })
  remove(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @GetAuthPayload() authPayload: AuthPayload,
  ) {
    return this.displayService.revoke(businessId, id, authPayload);
  }
}
