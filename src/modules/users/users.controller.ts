import { Body, Controller, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { OwnerOnlyGuard } from '@modules/auth/guards/owner-only.guard';
import { GetAuthPayload } from '@modules/auth/decorators/auth-payload.decorator';
import type { OwnerPayload } from '@modules/auth/types/auth-payload.type';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(OwnerOnlyGuard)
@AllowWithoutBusiness()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(@GetAuthPayload() payload: OwnerPayload, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.updateProfile(payload.userId, dto);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(@GetAuthPayload() payload: OwnerPayload, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(payload.userId, dto);
    return { message: 'Password changed successfully' };
  }
}
