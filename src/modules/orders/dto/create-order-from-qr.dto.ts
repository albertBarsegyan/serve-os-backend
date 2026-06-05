import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SelectedModifierDto {
  @ApiProperty({ example: 'uuid-v4-modifier-id' })
  @IsUUID()
  modifierId: string;

  @ApiProperty({ example: 'Extra cheese' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1.5 })
  @IsNumber()
  priceAdjustment: number;
}

export class CreateOrderFromQrItemDto {
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

export class CreateOrderFromQrDto {
  @ApiProperty({ example: 'session-token-uuid', required: false })
  @IsOptional()
  @IsString()
  sessionToken?: string;

  @ApiProperty({ type: [CreateOrderFromQrItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderFromQrItemDto)
  items: CreateOrderFromQrItemDto[];
}
