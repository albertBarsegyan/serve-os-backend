import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly logger: PinoLogger,
  ) {}

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Email already in use');
    }

    Object.assign(user, dto);
    const saved = await this.userRepository.save(user);
    this.logger.info({ userId }, 'User profile updated');
    return saved;
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const matches = await bcrypt.compare(dto.currentPassword, user.password);
    if (!matches) throw new UnauthorizedException('Current password is incorrect');

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepository.save(user);
    this.logger.info({ userId }, 'User password changed');
  }
}
