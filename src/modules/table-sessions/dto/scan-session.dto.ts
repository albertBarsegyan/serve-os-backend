import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ScanSessionDto {
  @ApiProperty({ example: 'uuid-qr-code', description: 'The qrCode value from the table entity' })
  @IsUUID()
  qrCode: string;
}
