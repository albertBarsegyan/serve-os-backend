import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDisplayDto {
  @ApiProperty({ example: 'Kitchen TV' })
  @IsNotEmpty()
  @IsString()
  name: string;
}
