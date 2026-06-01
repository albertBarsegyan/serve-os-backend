import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ScanSessionDto {
  @ApiProperty({ example: 'uuid-business-id' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: 'uuid-table-id' })
  @IsUUID()
  tableId: string;
}
