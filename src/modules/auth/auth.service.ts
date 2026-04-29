import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { User } from '@modules/users/entities/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { Staff } from '@modules/staff/entities/staff.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  businessId?: string;
  role?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {}

  private async generateTokens(
    user: User,
    staff: Staff | null,
  ): Promise<TokenPair> {
    const accessPayload = {
      sub: user.id,
      email: user.email,
      businessId: staff?.businessId ?? null,
      role: staff?.role ?? null,
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    };

    const refreshPayload = {
      sub: user.id,
      email: user.email,
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
      }),

      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<{ tokens: TokenPair; user: AuthUser }> {
    this.logger.debug(
      { email: registerDto.email },
      'Register request received',
    );

    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      this.logger.warn(
        { email: registerDto.email },
        'Register rejected because user already exists',
      );
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.info({ userId: savedUser.id }, 'User registered successfully');

    const tokens = await this.generateTokens(savedUser, null);

    return {
      tokens,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
      },
    };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ tokens: TokenPair; user: AuthUser }> {
    this.logger.debug({ email: loginDto.email }, 'Login request received');

    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      this.logger.warn(
        { email: loginDto.email },
        'Login failed: invalid credentials',
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const staff = await this.staffRepository.findOne({
      where: { userId: user.id },
    });

    const tokens = await this.generateTokens(user, staff ?? null);

    this.logger.info(
      { userId: user.id, businessId: staff?.businessId, role: staff?.role },
      'User authenticated successfully',
    );

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessId: staff?.businessId,
        role: staff?.role,
      },
    };
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Access denied');
    }

    const staff = await this.staffRepository.findOne({
      where: { userId: user.id },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      businessId: staff?.businessId,
      role: staff?.role,
    };
  }

  async refreshTokens(
    userId: string,
  ): Promise<{ tokens: TokenPair; user: AuthUser }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Access denied');
    }

    const staff = await this.staffRepository.findOne({
      where: { userId: user.id },
    });

    const tokens = await this.generateTokens(user, staff ?? null);

    this.logger.debug({ userId: user.id }, 'Tokens refreshed');

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessId: staff?.businessId,
        role: staff?.role,
      },
    };
  }
}
