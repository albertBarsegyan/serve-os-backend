import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class ProcessPaymentDto {
  @ApiProperty({ required: false, example: 3.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tipAmount?: number;
}
