import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { PaymentMethod } from '@common/enums/payment.enum';

export class RecordStaffPaymentDto {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: 25.5 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false, example: 2.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tipAmount?: number;
}
