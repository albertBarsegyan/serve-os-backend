import {
  IsNumberString,
  Length,
  IsString,
  MinLength,
  IsEmail,
  IsOptional,
  IsEnum,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StaffRole } from '@common/enums/staff-role.enum';

export class CreateStaffWithPinDto {
  @ApiProperty({ example: 'John Doe', description: 'Staff display name' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName: string;

  @ApiProperty({ enum: StaffRole, example: StaffRole.WAITER })
  @IsNotEmpty()
  @IsEnum(StaffRole)
  role: StaffRole;

  @ApiProperty({ example: '1234', description: 'Exactly 4 digits' })
  @IsNotEmpty()
  @IsNumberString()
  @Length(4, 4)
  pin: string;
}

export class CreateStaffWithPasswordDto {
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName: string;

  @ApiProperty({ enum: StaffRole })
  @IsNotEmpty()
  @IsEnum(StaffRole)
  role: StaffRole;

  @ApiProperty({ example: 'john@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'TempPassword123!', description: 'Minimum 8 characters' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  temporaryPassword: string;
}

export class CreateStaffWithInviteDto {
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName: string;

  @ApiProperty({ enum: StaffRole })
  @IsNotEmpty()
  @IsEnum(StaffRole)
  role: StaffRole;

  @ApiProperty({ example: 'john@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

export class AcceptInviteDto {
  @ApiProperty({ example: 'uuid-token', description: 'Invite token from email' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPassword123!', description: 'Minimum 8 characters' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class LoginWithPinDto {
  @ApiProperty({ example: 'uuid-staff-id' })
  @IsNotEmpty()
  @IsString()
  staffId: string;

  @ApiProperty({ example: '1234', description: 'Exactly 4 digits' })
  @IsNotEmpty()
  @IsNumberString()
  @Length(4, 4)
  pin: string;
}

export class LoginWithPasswordDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!' })
  @IsNotEmpty()
  @IsString()
  oldPassword: string;

  @ApiProperty({ example: 'NewPassword123!', description: 'Minimum 8 characters' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class UpdateStaffDto {
  @ApiProperty({ example: 'https://example.com/avatar.webp', required: false, nullable: true })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @ApiProperty({ example: 'Jane Doe', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName?: string;

  @ApiProperty({ enum: StaffRole, required: false })
  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  isActive?: boolean;
}

export class StaffResponseDto {
  id: string;

  businessId: string;

  displayName: string;

  avatarUrl?: string | null;

  role: string;

  authType: string;

  email?: string | null;

  employeeId: string | null;

  isActive: boolean;

  mustChangePassword: boolean;

  createdAt: Date;

  updatedAt: Date;

  // Note: pin, passwordHash, and inviteToken are excluded via @Exclude() decorator
}
