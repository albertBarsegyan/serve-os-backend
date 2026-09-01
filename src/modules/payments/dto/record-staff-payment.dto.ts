import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { PaymentMethod } from '@common/enums/payment.enum';
import { STAFF_TIP_ABSOLUTE_MAX_MAJOR_UNITS } from '@common/constants/tip.constants';

export class RecordStaffPaymentDto {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: 25.5 })
  @IsNumber()
  @Min(0)
  amount: number;

  // Typo guard only, not a business rule — staff have legitimate over-cap cases (cash tips
  // on comped bills, split-remainder corrections), so no subtotal-relative cap here.
  @ApiProperty({ required: false, example: 2.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(STAFF_TIP_ABSOLUTE_MAX_MAJOR_UNITS)
  tipAmount?: number;
}
