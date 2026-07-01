import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { StaffService } from './staff.service';
import { AuthGuard } from '@nestjs/passport';
import { BusinessAccessGuard } from '@common/guards/business-access.guard';
import { PaginationDto } from '@common/dto/pagination.dto';
import { Public } from '@common/decorators/public.decorator';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import {
  AcceptInviteDto,
  ChangePasswordDto,
  CreateStaffWithInviteDto,
  CreateStaffWithPasswordDto,
  CreateStaffWithPinDto,
  LoginWithPasswordDto,
  LoginWithPinDto,
  UpdateStaffDto,
} from './dto';

interface StaffJwtRequest {
  user: { staffId: string };
}

const STAFF_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@ApiTags('Staff')
@Controller()
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly configService: ConfigService,
  ) {}

  @Post('businesses/:businessId/staff/invite')
  @UseGuards(AuthGuard('jwt'), BusinessAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create staff member and send invite email' })
  @ApiResponse({ status: 201, description: 'Invite sent successfully' })
  async createWithInvite(
    @Param('businessId') businessId: string,
    @Body() dto: CreateStaffWithInviteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const createdByOwnerId = req.user?.type === 'owner' ? req.user.userId : undefined;
    if (!createdByOwnerId) throw new ForbiddenException('Owner access required');
    return this.staffService.createWithInvite(dto, createdByOwnerId, businessId);
  }

  @Post('businesses/:businessId/staff/pin')
  @UseGuards(AuthGuard('jwt'), BusinessAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create staff member with PIN authentication' })
  @ApiResponse({ status: 201, description: 'Staff created successfully' })
  async createWithPin(
    @Param('businessId') businessId: string,
    @Body() dto: CreateStaffWithPinDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const createdByOwnerId = req.user?.type === 'owner' ? req.user.userId : undefined;
    if (!createdByOwnerId) throw new ForbiddenException('Owner access required');
    return this.staffService.createWithPin(dto, createdByOwnerId, businessId);
  }

  // ── Creation (owner-only) ─────────────────────────────────────────────────

  @Post('businesses/:businessId/staff/password')
  @UseGuards(AuthGuard('jwt'), BusinessAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create staff member with password authentication' })
  @ApiResponse({ status: 201, description: 'Staff created successfully' })
  async createWithPassword(
    @Param('businessId') businessId: string,
    @Body() dto: CreateStaffWithPasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const createdByOwnerId = req.user?.type === 'owner' ? req.user.userId : undefined;
    if (!createdByOwnerId) throw new ForbiddenException('Owner access required');
    return this.staffService.createWithPassword(dto, createdByOwnerId, businessId);
  }

  @Public()
  @Post('staff/accept-invite')
  @ApiOperation({ summary: 'Accept staff invite and set password' })
  @ApiResponse({ status: 200, description: 'Invite accepted successfully' })
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.staffService.acceptInvite(dto);
  }

  @Public()
  @Post('businesses/:businessId/staff/login/pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff login with PIN' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async loginWithPin(
    @Param('businessId') businessId: string,
    @Body() dto: LoginWithPinDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.staffService.loginWithPin(businessId, dto.staffId, dto.pin);
    this.setStaffCookie(res, result.tokens.accessToken);
    return result;
  }

  @Public()
  @Post('businesses/:businessId/staff/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful or password change required' })
  async loginWithPassword(
    @Param('businessId') businessId: string,
    @Body() dto: LoginWithPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.staffService.loginWithPassword(dto.email, dto.password, businessId);
    if ('tokens' in result) {
      this.setStaffCookie(res, result.tokens.accessToken);
    }
    return result;
  }

  // ── Login (public) ────────────────────────────────────────────────────────

  @Post('businesses/:businessId/staff/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff logout — clears staff_access_token cookie' })
  logout(@Param('businessId') _businessId: string, @Res({ passthrough: true }) res: Response) {
    this.clearStaffCookie(res);
    return { message: 'ok' };
  }

  @Post('staff/change-password')
  @UseGuards(AuthGuard('staff-jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change staff password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @Req() req: StaffJwtRequest,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.staffService.changePassword(req.user.staffId, dto);
    this.clearStaffCookie(res);
    return result;
  }

  @Get('businesses/:businessId/staff')
  @UseGuards(AuthGuard('jwt'), BusinessAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated staff for a business' })
  async findAll(@Param('businessId') businessId: string, @Query() pagination: PaginationDto) {
    return this.staffService.findAll(businessId, pagination);
  }

  @Get('businesses/:businessId/staff/:staffId')
  @UseGuards(AuthGuard('jwt'), BusinessAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific staff member' })
  async findOne(@Param('businessId') businessId: string, @Param('staffId') staffId: string) {
    return this.staffService.findOne(staffId, businessId);
  }

  @Patch('businesses/:businessId/staff/:staffId')
  @UseGuards(AuthGuard('jwt'), BusinessAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update staff details' })
  async update(
    @Param('businessId') businessId: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(staffId, businessId, dto);
  }

  @Post('businesses/:businessId/staff/:staffId/unlock')
  @UseGuards(AuthGuard(['jwt', 'staff-jwt']), BusinessAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlock a PIN-locked staff member (owner or manager only)' })
  async unlock(@Param('businessId') businessId: string, @Param('staffId') staffId: string) {
    return this.staffService.unlockStaff(staffId, businessId);
  }

  @Delete('businesses/:businessId/staff/:staffId')
  @UseGuards(AuthGuard('jwt'), BusinessAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a staff member' })
  async remove(@Param('businessId') businessId: string, @Param('staffId') staffId: string) {
    await this.staffService.remove(staffId, businessId);
    return { success: true };
  }

  private setStaffCookie(res: Response, accessToken: string) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: STAFF_TOKEN_TTL_MS,
    });
  }

  private clearStaffCookie(res: Response) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    });
  }
}
