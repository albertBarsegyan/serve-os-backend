import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateModifierItemDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  priceAdjustment: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  position?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
