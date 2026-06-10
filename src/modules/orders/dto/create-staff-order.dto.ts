import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { SelectedModifierDto } from './create-order-from-qr.dto';
import { OrderType } from '../entities/order-type.enum';

export class CreateStaffOrderItemDto {
  @ApiProperty({ example: 'uuid-v4-product-id' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ required: false, example: 'No onions' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [SelectedModifierDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedModifierDto)
  selectedModifiers?: SelectedModifierDto[];
}

export class CreateStaffOrderDto {
  @ApiProperty({ enum: OrderType, example: OrderType.DINE_IN })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({ example: 'uuid-v4-table-id', required: false })
  @ValidateIf((o: CreateStaffOrderDto) => o.type === OrderType.DINE_IN)
  @IsUUID()
  tableId?: string;

  @ApiProperty({ type: [CreateStaffOrderItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStaffOrderItemDto)
  items: CreateStaffOrderItemDto[];

  @ApiProperty({ required: false, example: 'Jane Smith' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({ required: false, example: 'Birthday table, allergic to nuts' })
  @IsOptional()
  @IsString()
  notes?: string;
}
