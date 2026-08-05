import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from './entities/business.entity';
import { BusinessPaymentMethod } from './entities/business-payment-method.entity';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { User } from '@modules/users/entities/user.entity';
import { EmailVerifiedGuard } from '@modules/auth/guards/email-verified.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Business, BusinessPaymentMethod, User])],
  controllers: [BusinessController],
  providers: [BusinessService, EmailVerifiedGuard],
  exports: [BusinessService],
})
export class BusinessModule {}
