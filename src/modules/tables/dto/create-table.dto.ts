import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string | null;
}

export class ToggleTableStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;
}

export class SetTableReservationDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isReserved: boolean;
}
