import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';

export enum PaymentWebhookEvent {
  SUCCESS = 'success',
  FAILURE = 'failure',
  REFUND = 'refund',
}

export class PaymentWebhookDto {
  @ApiProperty({ example: 'uuid-order-id' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ example: 'uuid-business-id' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ enum: PaymentWebhookEvent, example: PaymentWebhookEvent.SUCCESS })
  @IsEnum(PaymentWebhookEvent)
  event: PaymentWebhookEvent;
}
