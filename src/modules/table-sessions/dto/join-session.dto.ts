import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class JoinSessionDto {
  @ApiProperty({
    example: 'uuid-session-id',
    description: 'The other session (same table) to merge into this one',
  })
  @IsUUID()
  sourceSessionId: string;
}
