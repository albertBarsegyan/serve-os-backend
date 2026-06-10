import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { User } from '@modules/users/entities/user.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthPayload, OwnerPayload, StaffPayload } from './types/auth-payload.type';
import * as bcrypt from 'bcrypt';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { StaffPermission, ROLE_PERMISSION_MAP } from '@common/enums/staff-permission.enum';
import { BusinessFeature } from '@common/enums/business-feature.enum';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface OwnerAuthUser {
  type: 'owner';
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  hasBusiness: boolean;
  role: string;
}

export interface StaffAuthUser {
  type: 'staff';
  staffId: string;
  displayName: string;
  email: string | null;
  businessId: string;
  role: StaffRole;
  permissions: StaffPermission[];
  business: { features: BusinessFeature[] };
}

export type AuthUser = OwnerAuthUser | StaffAuthUser;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Build the OwnerAuthUser shape from a User.
   */
  private buildAuthUser(user: User): OwnerAuthUser {
    return {
      type: 'owner',
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

  async getMe(userId: string): Promise<{ user: OwnerAuthUser }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      this.logger.warn({ userId }, 'getMe failed: user not found');
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      this.logger.warn({ userId }, 'getMe failed: user is inactive');
      throw new UnauthorizedException('User account is inactive');
    }

    return { user: this.buildAuthUser(user) };
  }

  async getStaffMe(staffId: string): Promise<{ user: StaffAuthUser }> {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId },
      relations: { business: true },
    });

    if (!staff) {
      this.logger.warn({ staffId }, 'getStaffMe failed: staff not found');
      throw new UnauthorizedException('Staff not found');
    }

    if (!staff.isActive) {
      this.logger.warn({ staffId }, 'getStaffMe failed: staff is inactive');
      throw new UnauthorizedException('Staff account is inactive');
    }

    return { user: this.buildStaffUser(staff) };
  }

  async getStaffRoster(slug: string): Promise<{
    business: { name: string; slug: string };
    staff: { id: string; displayName: string; role: StaffRole }[];
  }> {
    const business = await this.businessRepository.findOne({
      where: { slug, isActive: true },
      relations: { staff: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const activeStaff = (business.staff ?? [])
      .filter((s) => s.isActive)
      .map((s) => ({ id: s.id, displayName: s.displayName, role: s.role, authType: s.authType }));

    return { business: { name: business.name, slug: business.slug }, staff: activeStaff };
  }

  async loginStaffBySlug(
    slug: string,
    identifier: string,
    secret: string,
  ): Promise<{ tokens: { accessToken: string }; user: StaffAuthUser; requiresPasswordChange?: true }> {
    const business = await this.businessRepository.findOne({
      where: { slug, isActive: true },
    });

    if (!business) {
      this.logger.warn({ slug }, 'loginStaffBySlug: slug not found');
      throw new UnauthorizedException('Invalid credentials');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const staff = await this.staffRepository.findOne({
      where: isUuid
        ? { businessId: business.id, id: identifier, isActive: true }
        : { businessId: business.id, email: identifier, isActive: true },
      relations: { business: true },
    });

    if (!staff) {
      this.logger.warn({ slug, identifier }, 'loginStaffBySlug: staff not found');
      throw new UnauthorizedException('Invalid credentials');
    }

    const pinOk = staff.pin ? await bcrypt.compare(secret, staff.pin) : false;
    const passwordOk =
      !pinOk && staff.passwordHash ? await bcrypt.compare(secret, staff.passwordHash) : false;

    if (!pinOk && !passwordOk) {
      this.logger.warn({ slug, staffId: staff.id }, 'loginStaffBySlug: secret mismatch');
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: StaffPayload = {
      type: 'staff',
      staffId: staff.id,
      businessId: staff.businessId,
      role: staff.role,
    };

    if (staff.mustChangePassword) {
      const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '1h' });
      this.logger.info({ staffId: staff.id }, 'Staff authenticated but must change password');
      return { requiresPasswordChange: true, tokens: { accessToken }, user: this.buildStaffUser(staff) };
    }

    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '24h' });
    this.logger.info(
      { staffId: staff.id, businessId: staff.businessId },
      'Staff authenticated via slug',
    );

    return { tokens: { accessToken }, user: this.buildStaffUser(staff) };
  }

  private buildStaffUser(staff: Staff): StaffAuthUser {
    return {
      type: 'staff',
      staffId: staff.id,
      displayName: staff.displayName,
      email: staff.email,
      businessId: staff.businessId,
      role: staff.role,
      permissions: ROLE_PERMISSION_MAP[staff.role],
      business: { features: staff.business?.features ?? [] },
    };
  }

  async refreshTokens(
    userId: string,
    incomingRefreshToken: string,
  ): Promise<{ tokens: TokenPair; user: AuthUser }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      this.logger.warn({ userId }, 'refreshTokens failed: user not found');
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      this.logger.warn({ userId }, 'refreshTokens failed: user is inactive');
      throw new UnauthorizedException('User account is inactive');
    }

    if (!user.refreshToken) {
      // No token stored — user has logged out or never logged in via this flow.
      this.logger.warn({ userId }, 'refreshTokens failed: no refresh token stored');
      throw new UnauthorizedException('No valid refresh token');
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
      throw new UnauthorizedException('Invalid or expired refresh token');
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
