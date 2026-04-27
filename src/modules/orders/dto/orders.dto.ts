import {
  IsNotEmpty,
  IsUUID,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '../entities/order.entity';

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

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
    required: false,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

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
