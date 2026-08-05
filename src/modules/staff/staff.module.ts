import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Staff } from './entities/staff.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { Business } from '@modules/business/entities/business.entity';
import { User } from '@modules/users/entities/user.entity';
import { EmailService } from '@common/services/email.service';
import { StaffJwtStrategy } from '@modules/auth/strategies/staff-jwt.strategy';
import { EmailVerifiedGuard } from '@modules/auth/guards/email-verified.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Staff, Business, User]),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [StaffController],
  providers: [StaffService, EmailService, StaffJwtStrategy, EmailVerifiedGuard],
  exports: [StaffService],
})
export class StaffModule {}
