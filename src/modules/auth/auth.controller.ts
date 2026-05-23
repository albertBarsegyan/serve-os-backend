import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { type Response, Request as ExpressRequest } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from '@common/decorators/public.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { AuthUser } from '@common/decorators/auth-user.decorator';
import type { AuthenticatedUser } from '@common/types/authenticated-request.type';

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
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
    @Request() req: ExpressRequest & { user: { sub: string; refreshToken: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.refreshTokens(
      req.user.sub,
      req.user.refreshToken,
    );
    this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    return { user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Logout and clear token cookies' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(
    @AuthUser() _authUser: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(_authUser.id);
    this.clearTokenCookies(res);
    return { message: 'ok' };
  }

  @Get('me')
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user info' })
  me(
    @Tenant(false) _businessId: null,
    @Request()
    req: ExpressRequest & {
      user: {
        id: string;
      };
    },
  ) {
    return this.authService.getMe(req?.user?.id);
  }
}
