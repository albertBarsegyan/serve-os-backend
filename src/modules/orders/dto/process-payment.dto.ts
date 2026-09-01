import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { STAFF_TIP_ABSOLUTE_MAX_MAJOR_UNITS } from '@common/constants/tip.constants';

export class ProcessPaymentDto {
  // Typo guard only, not a business rule — staff have legitimate over-cap cases (cash tips
  // on comped bills, split-remainder corrections), so no subtotal-relative cap here.
  @ApiProperty({ required: false, example: 3.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(STAFF_TIP_ABSOLUTE_MAX_MAJOR_UNITS)
  tipAmount?: number;
}
