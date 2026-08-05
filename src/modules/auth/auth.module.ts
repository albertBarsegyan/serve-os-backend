import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '@modules/users/entities/user.entity';
import { BusinessModule } from '@modules/business/business.module';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { StaffModule } from '@modules/staff/staff.module';
import { EmailService } from '@common/services/email.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { StaffJwtStrategy } from './strategies/staff-jwt.strategy';
import { UnifiedAuthGuard } from './guards/unified-auth.guard';
import { OwnerOnlyGuard } from './guards/owner-only.guard';
import { StaffOnlyGuard } from './guards/staff-only.guard';
import { EmailVerifiedGuard } from './guards/email-verified.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Staff, Business]),
    BusinessModule,
    StaffModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    ConfigModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    StaffJwtStrategy,
    UnifiedAuthGuard,
    OwnerOnlyGuard,
    StaffOnlyGuard,
    EmailVerifiedGuard,
    EmailService,
  ],
  controllers: [AuthController],
  exports: [AuthService, UnifiedAuthGuard, OwnerOnlyGuard, StaffOnlyGuard, EmailVerifiedGuard],
})
export class AuthModule {}
