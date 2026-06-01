import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

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
}
