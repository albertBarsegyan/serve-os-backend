import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { GUEST_TIP_ABSOLUTE_MAX_MINOR_UNITS } from '@common/constants/tip.constants';

/** What the tip percentage is computed against. Only SUBTOTAL exists today; kept as an
 * enum (not hardcoded) so a future basis (e.g. pre-discount) doesn't need a breaking DTO
 * change. The server always recomputes off the order's own subtotal regardless of what the
 * client sends — this field is recorded for audit/analytics, not trusted as instruction. */
export enum TipBasis {
  SUBTOTAL = 'SUBTOTAL',
}

export class CreateTipDto {
  // Minor currency units (cents) — integer, so client/server never disagree over floating
  // point rounding. Exactly one of amount/percentage must be set (checked in the service,
  // not expressible cleanly as a class-validator decorator pair).
  @ApiProperty({
    required: false,
    example: 500,
    description: 'Flat tip amount in minor units (cents). Exactly one of amount/percentage.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(GUEST_TIP_ABSOLUTE_MAX_MINOR_UNITS)
  amount?: number;

  @ApiProperty({
    required: false,
    example: 18,
    description: 'Tip as a percentage of the order subtotal. Exactly one of amount/percentage.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ApiProperty({ enum: TipBasis, example: TipBasis.SUBTOTAL })
  @IsEnum(TipBasis)
  basis: TipBasis;

  @ApiProperty({
    example: 'a2f6e2d0-6b7a-4c3e-9e8a-1c2d3e4f5a6b',
    description: 'Client-generated key; a replayed key returns the original result unchanged.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  idempotencyKey: string;
}

export class TipResponseDto {
  @ApiProperty({ example: 'a2f6e2d0-6b7a-4c3e-9e8a-1c2d3e4f5a6b' })
  orderId: string;

  // Major currency units — the order's authoritative total confirmed tip (SUM across all
  // CONFIRMED payments), not just this write. Callers must use this value, not the amount
  // they submitted: the server may have rounded or clamped it.
  @ApiProperty({ example: 5 })
  tipAmount: number;

  @ApiProperty({ example: 'b3f7e2d0-6b7a-4c3e-9e8a-1c2d3e4f5a6c' })
  paymentId: string;
}
