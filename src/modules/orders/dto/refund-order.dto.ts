import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefundOrderDto {
  @ApiProperty({
    required: false,
    description: 'External refund reference (e.g. bank transfer ID). Generated if omitted.',
  })
  @IsOptional()
  @IsString()
  refundId?: string;
}
