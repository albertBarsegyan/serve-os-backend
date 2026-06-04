import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '@modules/staff/entities/staff.entity';

export interface StaffJwtPayload {
  staffId: string;
  businessId: string;
  role: string;
  authType: string;
  type: 'staff';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedStaff {
  staffId: string;
  businessId: string;
  role: string;
  authType: string;
}

@Injectable()
export class StaffJwtStrategy extends PassportStrategy(Strategy, 'staff-jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
        const fromCookie = cookies?.['staff_access_token'] as string;
        if (fromCookie) return fromCookie;
        const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        return fromHeader || null;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: StaffJwtPayload): Promise<AuthenticatedStaff> {
    if (!payload) {
      throw new UnauthorizedException('Invalid staff token payload');
    }

    const staff = await this.staffRepository.findOne({
      where: { id: payload.staffId, businessId: payload.businessId, isActive: true },
    });

    if (!staff) {
      throw new UnauthorizedException('Staff member not found or is inactive');
    }

    return {
      staffId: staff.id,
      businessId: staff.businessId,
      role: staff.role,
      authType: staff.authType,
    };
  }
}
