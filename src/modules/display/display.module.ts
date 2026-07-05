import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Display } from './entities/display.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { DisplayService } from './display.service';
import { DisplayController } from './display.controller';
import { PublicDisplayController } from './public-display.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Display, Business, Order])],
  controllers: [DisplayController, PublicDisplayController],
  providers: [DisplayService],
  exports: [DisplayService],
})
export class DisplayModule {}
