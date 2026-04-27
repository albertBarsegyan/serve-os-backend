import { Module, forwardRef } from '@nestjs/common';
import { KitchenGateway } from './kitchen.gateway';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';
import { OrdersModule } from '@modules/orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  providers: [KitchenGateway, KitchenService],
  controllers: [KitchenController],
  exports: [KitchenGateway],
})
export class KitchenModule {}
