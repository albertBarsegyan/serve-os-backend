import { IsNotEmpty, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTableDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  number: number;

  @ApiProperty({ example: 4 })
  @IsNotEmpty()
  @IsNumber()
  capacity: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
