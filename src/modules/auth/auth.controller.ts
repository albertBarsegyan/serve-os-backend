import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Delete,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { type Request as ExpressRequest, type Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { BusinessService } from '@modules/business/business.service';
import {
  LoginDto,
  RegisterDto,
  SlugStaffLoginDto,
  StaffLookupDto,
  StaffPinLoginDto,
} from './dto/auth.dto';
import { Public } from '@common/decorators/public.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { UnifiedAuthGuard } from '@modules/auth/guards/unified-auth.guard';
import { GetAuthPayload } from '@modules/auth/decorators/auth-payload.decorator';
import type { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { clearBusinessCookie, setBusinessCookie } from '@common/utils/business.utils';
import { ErrorResponseDto } from '@common/dto/error-response.dto';

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STAFF_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly businessService: BusinessService,
  ) {}

  private getCookieBase() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN');
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    };
  }

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    const base = this.getCookieBase();

    res.cookie('access_token', accessToken, {
      ...base,
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_MS,
    });

    res.cookie('refresh_token', refreshToken, {
      ...base,
      path: '/api/auth/refresh',
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }

  private clearTokenCookies(res: Response) {
    const base = this.getCookieBase();
    res.clearCookie('access_token', { ...base, path: '/' });
    res.clearCookie('refresh_token', { ...base, path: '/api/auth/refresh' });
  }

  // Staff sessions intentionally use a single long-lived access token (24 h) with no
  // refresh token. Staff devices are trusted, shared terminals; the overhead of token
  // rotation adds no security benefit, and a 24 h timeout matches the shift length.
  private setStaffAccessCookie(res: Response, accessToken: string) {
    const base = this.getCookieBase();
    res.cookie('access_token', accessToken, {
      ...base,
      path: '/',
      maxAge: STAFF_TOKEN_TTL_MS,
    });
  }

  @Public()
  @AllowWithoutBusiness()
  @Get('staff/roster')
  @ApiOperation({ summary: 'Get staff roster for a business by slug' })
  @ApiResponse({
    status: 200,
    description: 'Business name + list of active staff (id, displayName, role only)',
  })
  @ApiResponse({ status: 404, description: 'Business slug not found or inactive' })
  async staffRoster(@Query('slug') slug: string) {
    return this.authService.getStaffRoster(slug);
  }

  @Public()
  @AllowWithoutBusiness()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('staff/lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Look up staff by employeeId — returns safe subset only' })
  @ApiResponse({ status: 200, description: 'Staff found' })
  @ApiResponse({ status: 404, description: 'Employee ID not found' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  async staffLookup(@Body() dto: StaffLookupDto) {
    return this.authService.lookupStaffByEmployeeId(dto.employeeId, dto.businessId);
  }

  @Public()
  @AllowWithoutBusiness()
  @Post('staff/pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff PIN login — issues access_token cookie on success' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid PIN or too many attempts' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  async staffPinLogin(
    @Body() dto: StaffPinLoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress;
    const result = await this.authService.loginStaffWithPin(
      dto.staffId,
      dto.pin,
      dto.businessId,
      ip,
    );
    this.setStaffAccessCookie(res, result.tokens.accessToken);
    return result;
  }

  @Public()
  @AllowWithoutBusiness()
  @Post('staff/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff login by slug — PIN (staffId + pin) or email + password' })
  @ApiResponse({ status: 200, description: 'Login successful; sets access_token cookie' })
  @ApiResponse({ status: 401, description: 'Invalid credentials (slug, staff, or secret)' })
  async staffLoginBySlug(
    @Body() dto: SlugStaffLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginStaffBySlug(dto.slug, dto.identifier, dto.secret);
    this.setStaffAccessCookie(res, result.tokens.accessToken);
    return result;
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({
    status: 409,
    description: 'User already exists',
    type: ErrorResponseDto,
  })
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { tokens, user } = await this.authService.register(registerDto);
    this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    return { user, tokens };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or user not found',
    type: ErrorResponseDto,
  })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    try {
      const { tokens, user } = await this.authService.login(loginDto);
      this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
      // Return tokens in body as well for non-cookie-based clients
      return { user, tokens };
    } catch (e) {
      res.clearCookie('access_token');
      res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
      throw e;
    }
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
    type: ErrorResponseDto,
  })
  async refresh(
    @Req() req: ExpressRequest & { user: { sub: string; refreshToken: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.refreshTokens(
      req.user.sub,
      req.user.refreshToken,
    );
    this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    return { user };
  }

  @UseGuards(UnifiedAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Logout and clear token cookies' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(
    @GetAuthPayload() authPayload: AuthPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Extract the user ID based on payload type
    const userId = authPayload.type === 'owner' ? authPayload.userId : null;
    if (userId) {
      await this.authService.logout(userId);
    }

    this.clearTokenCookies(res);

    clearBusinessCookie(
      res,
      this.configService.get<string>('NODE_ENV') === 'production',
      this.configService.get<string>('COOKIE_DOMAIN'),
    );

    return { message: 'ok' };
  }

  @Get('me')
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Get current authenticated user (owner or staff)' })
  @ApiResponse({ status: 200, description: 'Current user info' })
  @ApiResponse({
    status: 401,
    description: 'User not found or inactive',
    type: ErrorResponseDto,
  })
  me(@GetAuthPayload() authPayload: AuthPayload) {
    if (authPayload.type === 'owner') {
      return this.authService.getMe(authPayload.userId);
    }
    return this.authService.getStaffMe(authPayload.staffId);
  }

  @UseGuards(UnifiedAuthGuard)
  @Post('business')
  @HttpCode(HttpStatus.OK)
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Select / switch active business' })
  @ApiResponse({ status: 200, description: 'Business selected' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - no access to this business',
    type: ErrorResponseDto,
  })
  async selectBusiness(
    @GetAuthPayload() authPayload: AuthPayload,
    @Body('businessId') businessId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      await this.businessService.findOne(businessId, authPayload);
    } catch {
      throw new ForbiddenException('You do not have access to this business');
    }

    setBusinessCookie({
      res,
      businessId,
      isProduction: this.configService.get<string>('NODE_ENV') === 'production',
      domain: this.configService.get<string>('COOKIE_DOMAIN'),
    });

    return { message: 'ok' };
  }

  @UseGuards(UnifiedAuthGuard)
  @Delete('business')
  @HttpCode(HttpStatus.OK)
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Clear selected business' })
  @ApiResponse({ status: 200, description: 'Business cleared' })
  clearBusiness(@Res({ passthrough: true }) res: Response) {
    clearBusinessCookie(
      res,
      this.configService.get<string>('NODE_ENV') === 'production',
      this.configService.get<string>('COOKIE_DOMAIN'),
    );
    return { message: 'ok' };
  }
}
