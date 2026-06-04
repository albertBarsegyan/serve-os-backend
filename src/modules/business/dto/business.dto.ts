import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BusinessType } from '@common/enums/business-type.enum';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { PaymentMethod } from '@common/enums/payment.enum';

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

  @ApiProperty({
    enum: BusinessFeature,
    isArray: true,
    required: false,
    description:
      'Optional: Specific features to enable. If not provided, defaults from business type preset will be used.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(BusinessFeature, { each: true })
  features?: BusinessFeature[];
}

export class UpsertPaymentMethodDto {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.ONLINE })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    required: false,
    description:
      'Method-specific config. For ONLINE: { clientId, secretKey, merchantId, testMode }',
    example: { clientId: 'xxx', secretKey: 'yyy', merchantId: '12345', testMode: false },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
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

  @ApiProperty({
    enum: BusinessFeature,
    isArray: true,
    required: false,
    description: 'Optional: Update enabled features for the business.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(BusinessFeature, { each: true })
  features?: BusinessFeature[];
}
