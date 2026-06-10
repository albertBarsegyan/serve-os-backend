import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@restaurant.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsNotEmpty()
  @IsString()
  password: string;
}

export class SlugStaffLoginDto {
  @ApiProperty({ example: 'my-restaurant', description: 'Business slug' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({
    example: 'uuid-staff-id or staff@example.com',
    description: 'Staff ID (PIN flow) or email (password flow)',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: '1234 or password', description: 'PIN or password' })
  @IsString()
  @IsNotEmpty()
  secret: string;
}

/**
 * RegisterDto - handles user registration
 * Note: role is intentionally excluded and always defaults to Role.OWNER
 */
export class RegisterDto {
  @ApiProperty({ example: 'user@restaurant.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;
}
