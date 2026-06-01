import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsUrl,
  Min,
  Max,
  ArrayNotEmpty,
  IsArray,
  ArrayUnique,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { ServicePeriod, DietaryFlag, Allergen } from './product.enums';

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

export class CreateProductVariantDto {
  @ApiProperty({ example: 'Large' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 5.0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  price: number;

  @ApiProperty({ example: 'sku-123', required: false })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiProperty({ example: 0, required: false })
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
  @Min(0.01)
  basePrice: number;

  @ApiProperty({ example: 20.0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  compareAtPrice?: number;

  @ApiProperty({ example: 'burger', required: false })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ example: 'sku-123', required: false })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(180)
  prepTimeMinutes?: number;

  @ApiProperty({ example: ServicePeriod.ALL_DAY, required: false })
  @IsOptional()
  @IsEnum(ServicePeriod)
  availablePeriod?: ServicePeriod;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(DietaryFlag, { each: true })
  dietaryFlags?: DietaryFlag[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Allergen, { each: true })
  allergens?: Allergen[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUrl(undefined, { each: true })
  imageUrls?: string[];

  @ApiProperty({ type: [CreateProductVariantDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
