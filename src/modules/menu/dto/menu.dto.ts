import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Main Dishes' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'uuid-v4-category-id' })
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'Burger' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Delicious beef burger', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 15.5 })
  @IsNotEmpty()
  @IsNumber()
  price: number;

  @ApiProperty({ example: 'https://example.com/image.jpg', required: false })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
