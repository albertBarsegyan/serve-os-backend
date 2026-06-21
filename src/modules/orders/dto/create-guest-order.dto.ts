import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@common/enums/payment.enum';
import { CreateOrderFromQrItemDto } from './create-order-from-qr.dto';

export class CreateGuestOrderDto {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ type: [CreateOrderFromQrItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderFromQrItemDto)
  items: CreateOrderFromQrItemDto[];

  @ApiProperty({ required: false, example: 'Table near the window, please' })
  @IsOptional()
  @IsString()
  notes?: string;
}
