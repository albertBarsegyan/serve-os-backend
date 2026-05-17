import { IsNotEmpty, IsUUID, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@common/enums/payment.enum';

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
