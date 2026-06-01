import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { OrdersService } from '@modules/orders/orders.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly ordersService: OrdersService) {}
  @Public()
  @AllowWithoutBusiness()
  @Post('payment')
  @ApiOperation({ summary: 'Payment provider webhook for order payment outcomes' })
  handlePaymentWebhook(@Body() dto: PaymentWebhookDto) {
    return this.ordersService.processPaymentWebhook(dto.orderId, dto.businessId, dto.event);
  }
}
