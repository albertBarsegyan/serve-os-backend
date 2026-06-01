import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Delete,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { type Request as ExpressRequest, type Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { BusinessService } from '@modules/business/business.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from '@common/decorators/public.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { UnifiedAuthGuard } from '@modules/auth/guards/unified-auth.guard';
import { GetAuthPayload } from '@modules/auth/decorators/auth-payload.decorator';
import type { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { clearBusinessCookie, setBusinessCookie } from '@common/utils/business.utils';

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
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

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'User already exists' })
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
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
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

    clearBusinessCookie(res, this.configService.get<string>('NODE_ENV') === 'production');

    return { message: 'ok' };
  }

  @Get('me')
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user info' })
  me(@Tenant(false) _businessId: null, @GetAuthPayload() authPayload: AuthPayload) {
    if (authPayload.type !== 'owner') {
      throw new ForbiddenException('Owner access required');
    }

    return this.authService.getMe(authPayload.userId);
  }

  @UseGuards(UnifiedAuthGuard)
  @Post('business')
  @HttpCode(HttpStatus.OK)
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Select / switch active business' })
  @ApiResponse({ status: 200, description: 'Business selected' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
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
    // Clear the cookie used for selected business
    res.clearCookie('business_id');
    return { message: 'ok' };
  }
}
