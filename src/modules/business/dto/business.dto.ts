import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BusinessType } from '../entities/business.entity';

export class CreateBusinessDto {
  @ApiProperty({ example: 'My Restaurant' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ enum: BusinessType, example: BusinessType.RESTAURANT })
  @IsNotEmpty()
  @IsEnum(BusinessType)
  type: BusinessType;

  @ApiProperty({ example: '123 Main St, New York' })
  @IsNotEmpty()
  @IsString()
  location: string;

  @ApiProperty({ example: 'USD' })
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiProperty({ example: { monday: '09:00-22:00' }, required: false })
  @IsOptional()
  workingHours?: any;
}

export class UpdateBusinessDto {
  @ApiProperty({ example: 'My Restaurant Updated', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ enum: BusinessType, required: false })
  @IsOptional()
  @IsEnum(BusinessType)
  type?: BusinessType;

  @ApiProperty({ example: '456 Side St, New York', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: 'EUR', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: { monday: '10:00-23:00' }, required: false })
  @IsOptional()
  workingHours?: any;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
