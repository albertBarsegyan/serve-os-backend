import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '@modules/users/entities/user.entity';
import { BusinessModule } from '@modules/business/business.module';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { StaffJwtStrategy } from './strategies/staff-jwt.strategy';
import { UnifiedAuthGuard } from './guards/unified-auth.guard';
import { OwnerOnlyGuard } from './guards/owner-only.guard';
import { StaffOnlyGuard } from './guards/staff-only.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Staff, Business]),
    BusinessModule,
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
  ],
  controllers: [AuthController],
  exports: [AuthService, UnifiedAuthGuard, OwnerOnlyGuard, StaffOnlyGuard],
})
export class AuthModule {}
