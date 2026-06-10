import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateModifierItemDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  priceAdjustment: number;

  @IsOptional()
  @IsString()
  @IsIn(['adjustment', 'fixed'])
  priceType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  position?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
