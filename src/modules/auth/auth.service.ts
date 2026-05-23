import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { User } from '@modules/users/entities/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { Staff } from '@modules/staff/entities/staff.entity';
import { Role } from '@common/enums/role.enum';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  hasBusiness: boolean;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Build the AuthUser shape from a User + optional Staff record.
   * Staff role takes precedence over base user role when present.
   */
  private buildAuthUser(user: User, staff: Staff | null): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      hasBusiness: user.hasBusiness,
      role: staff?.role ?? user.role,
    };
  }

  /**
   * Generate JWT token pair for a user.
   * If staff record exists, use staff role; otherwise use user's base role.
   */
  private async generateTokens(user: User): Promise<TokenPair> {
    const payload = { sub: user.id };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(user.id, { refreshToken: hashedRefreshToken });

    return { accessToken, refreshToken };
  }

  /**
   * Register a new user with role hardcoded to OWNER.
   * Role cannot be set from the request body.
   */
  async register(registerDto: RegisterDto): Promise<{ tokens: TokenPair; user: AuthUser }> {
    this.logger.debug({ email: registerDto.email }, 'Register request received');

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
      role: Role.OWNER,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.info({ userId: savedUser.id }, 'User registered successfully');

    const tokens = await this.generateTokens(savedUser);

    return {
      tokens,
      user: this.buildAuthUser(savedUser, null),
    };
  }

  async login(loginDto: LoginDto): Promise<{ tokens: TokenPair; user: AuthUser }> {
    this.logger.debug({ email: loginDto.email }, 'Login request received');

    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      this.logger.warn({ email: loginDto.email }, 'Login failed: invalid credentials');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      this.logger.warn({ email: loginDto.email }, 'Login failed: user is inactive');
      throw new UnauthorizedException('Access denied');
    }

    const staff = await this.staffRepository.findOne({
      where: { userId: user.id },
    });

    // generateTokens persists the hashed refresh token
    const tokens = await this.generateTokens(user);

    this.logger.info(
      { userId: user.id, businessId: staff?.businessId, role: staff?.role ?? user.role },
      'User authenticated successfully',
    );

    return {
      tokens,
      user: this.buildAuthUser(user, staff ?? null),
    };
  }

  async getMe(userId: string): Promise<{ user: AuthUser }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user?.isActive) {
      throw new UnauthorizedException('Access denied');
    }

    const staff = await this.staffRepository.findOne({
      where: { userId: user.id },
    });

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      hasBusiness: user?.hasBusiness,
      role: staff?.role ?? user.role,
    };

    return {
      user: authUser,
    };
  }

  async refreshTokens(
    userId: string,
    incomingRefreshToken: string,
  ): Promise<{ tokens: TokenPair; user: AuthUser }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user?.isActive) {
      throw new UnauthorizedException('Access denied');
    }

    if (!user.refreshToken) {
      // No token stored — user has logged out or never logged in via this flow.
      throw new UnauthorizedException('Access denied');
    }

    const tokenMatches = await bcrypt.compare(incomingRefreshToken, user.refreshToken);
    if (!tokenMatches) {
      // Token mismatch — could be a reuse attempt after rotation.
      // Invalidate all sessions defensively by clearing the stored token.
      await this.userRepository.update(userId, { refreshToken: null });
      this.logger.warn(
        { userId },
        'Refresh token mismatch — possible reuse attack, sessions cleared',
      );
      throw new UnauthorizedException('Access denied');
    }

    const staff = await this.staffRepository.findOne({
      where: { userId: user.id },
    });

    // generateTokens atomically replaces the stored hash with the new token
    const tokens = await this.generateTokens(user);

    this.logger.debug({ userId: user.id }, 'Tokens refreshed');

    return {
      tokens,
      user: this.buildAuthUser(user, staff ?? null),
    };
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: null });
    this.logger.info({ userId }, 'User logged out');
  }
}
