import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import type { AuthPayload } from '../types/auth-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const typedReq = req as {
            cookies?: { access_token?: string; staff_access_token?: string };
          };
          return typedReq.cookies?.access_token ?? typedReq.cookies?.staff_access_token ?? null;
        },

        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  validate(payload: AuthPayload): AuthPayload {
    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    return payload;
  }
}
