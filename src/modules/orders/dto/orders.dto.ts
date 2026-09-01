import {
  IsNotEmpty,
  IsUUID,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@common/enums/payment.enum';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order-status.enum';
import { STAFF_TIP_ABSOLUTE_MAX_MAJOR_UNITS } from '@common/constants/tip.constants';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'uuid-v4-product-id' })
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 'No onions', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'uuid-v4-table-id' })
  @IsNotEmpty()
  @IsUUID()
  tableId: string;

  @ApiProperty({ example: 'uuid-v4-staff-id', required: false })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({ example: 'session-token-from-qr', required: false })
  @IsOptional()
  @IsString()
  sessionToken?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CONFIRMED })
  @IsNotEmpty()
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

export class ConfirmOrderPaymentDto {
  @ApiProperty({
    enum: PaymentMethod,
    required: false,
    description: 'Override payment method (defaults to POS). Use CASH if customer paid with cash.',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  // Typo guard only, not a business rule — staff have legitimate over-cap cases (cash tips
  // on comped bills, split-remainder corrections), so no subtotal-relative cap here.
  @ApiProperty({ example: 5.0, required: false, description: 'Optional tip amount.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(STAFF_TIP_ABSOLUTE_MAX_MAJOR_UNITS)
  tipAmount?: number;
}
