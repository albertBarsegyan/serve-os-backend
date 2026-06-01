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
