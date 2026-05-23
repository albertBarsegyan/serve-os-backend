import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '@modules/users/entities/user.entity';
import { AuthenticatedUser } from '@common/types/authenticated-request.type';

export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        // First try cookie (used by browser clients). Fallback to Authorization header (Bearer).
        const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
        const fromCookie = cookies?.['access_token'] as string;
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[jwt.strategy] cookies:', cookies);
        }
        if (fromCookie) return fromCookie;
        const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req as any);
        return fromHeader || null;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[jwt.strategy] validated payload:', payload);
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub, isActive: true },
      select: ['id', 'email', 'firstName', 'lastName', 'hasBusiness', 'role'],
    });

    if (!user) {
      throw new UnauthorizedException('Access denied');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      hasBusiness: user.hasBusiness,
      role: user.role,
    };
  }
}
