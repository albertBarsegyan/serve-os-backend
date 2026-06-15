import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

interface JwtRefreshPayload {
  sub: string; // user.id — set explicitly in generateTokensForOwner
  userId: string;
  type: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => {
        return req?.cookies?.['refresh_token'] as string;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') as string,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtRefreshPayload) {
    const refreshToken = req.cookies?.['refresh_token'] as string;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found in cookies');
    }

    if (!payload) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    return { sub: payload.sub, refreshToken };
  }
}
