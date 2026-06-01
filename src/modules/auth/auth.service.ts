import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { User } from '@modules/users/entities/user.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthPayload, OwnerPayload, StaffPayload } from './types/auth-payload.type';
import * as bcrypt from 'bcrypt';
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
   * Build the AuthUser shape from a User.
   * Owners use their User role; Staff members authenticate via separate endpoint.
   */
  private buildAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      hasBusiness: user.hasBusiness,
      role: user.role,
    };
  }

  /**
   * Generate JWT token pair with an AuthPayload.
   * Signs the payload directly into the JWT.
   */
  private async generateTokens(payload: AuthPayload): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Generate JWT token pair for an owner (user).
   */
  private async generateTokensForOwner(user: User): Promise<TokenPair> {
    const payload: OwnerPayload = {
      type: 'owner',
      userId: user.id,
      email: user.email,
    };

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
    const tokens = await this.generateTokensForOwner(savedUser);
    this.logger.info({ userId: savedUser.id }, 'User registered successfully');

    return {
      tokens,
      user: this.buildAuthUser(savedUser),
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

    const tokens = await this.generateTokensForOwner(user);

    this.logger.info({ userId: user.id, role: user.role }, 'User authenticated successfully');

    return {
      tokens,
      user: this.buildAuthUser(user),
    };
  }

  /**
   * Login an owner (user) and return JWT with OwnerPayload.
   */
  async loginOwner(user: User): Promise<{ access_token: string }> {
    const payload: OwnerPayload = {
      type: 'owner',
      userId: user.id,
      email: user.email,
    };

    const access_token = await this.jwtService.signAsync(payload);
    return { access_token };
  }

  /**
   * Login a staff member and return JWT with StaffPayload.
   */
  async loginStaff(staff: Staff): Promise<{ access_token: string }> {
    const payload: StaffPayload = {
      type: 'staff',
      staffId: staff.id,
      businessId: staff.businessId,
      role: staff.role,
    };

    const access_token = await this.jwtService.signAsync(payload);
    return { access_token };
  }

  async getMe(userId: string): Promise<{ user: AuthUser }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user?.isActive) {
      throw new UnauthorizedException('Access denied');
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      hasBusiness: user?.hasBusiness,
      role: user.role,
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

    // generateTokensForOwner atomically replaces the stored hash with the new token
    const tokens = await this.generateTokensForOwner(user);

    this.logger.debug({ userId: user.id }, 'Tokens refreshed');

    return {
      tokens,
      user: this.buildAuthUser(user),
    };
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: null });
    this.logger.info({ userId }, 'User logged out');
  }
}
