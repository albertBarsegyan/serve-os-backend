import { IsNotEmpty, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StaffRole } from '@common/enums/staff-role.enum';

export class CreateStaffDto {
  @ApiProperty({ example: 'uuid-v4-user-id' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: StaffRole, example: StaffRole.WAITER })
  @IsNotEmpty()
  @IsEnum(StaffRole)
  role: StaffRole;
}
