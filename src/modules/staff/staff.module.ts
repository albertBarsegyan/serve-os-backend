import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Staff } from './entities/staff.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { Business } from '@modules/business/entities/business.entity';
import { EmailService } from '@common/services/email.service';
import { StaffJwtStrategy } from '@modules/auth/strategies/staff-jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Staff, Business]),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [StaffController],
  providers: [StaffService, EmailService, StaffJwtStrategy],
  exports: [StaffService],
})
export class StaffModule {}
