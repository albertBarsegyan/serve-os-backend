import {
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@modules/orders/entities/order.entity';

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-v4-order-id' })
  @IsNotEmpty()
  @IsUUID()
  orderId: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: 25.5 })
  @IsNotEmpty()
  @IsNumber()
  amount: number;
}
