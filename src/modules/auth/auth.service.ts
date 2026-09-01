import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { randomBytes } from 'crypto';
import { User } from '@modules/users/entities/user.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { StaffService } from '@modules/staff/staff.service';
import { EmailService } from '@common/services/email.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthPayload, OwnerPayload, StaffPayload } from './types/auth-payload.type';
import * as bcrypt from 'bcrypt';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { StaffAuthType } from '@common/enums/staff-auth-type.enum';
import { StaffPermission, ROLE_PERMISSION_MAP } from '@common/enums/staff-permission.enum';
import { BusinessFeature } from '@common/enums/business-feature.enum';

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
// How long a just-rotated-out refresh token is still accepted. Covers benign multi-tab
// races (two tabs both refresh on the same pre-rotation cookie around access-token expiry)
// without weakening reuse detection for a token that's actually been stolen and replayed later.
const REFRESH_TOKEN_GRACE_WINDOW_MS = 30 * 1000;

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
  avatarUrl: string | null;
  hasBusiness: boolean;
  role: string;
}

export interface StaffAuthUser {
  type: 'staff';
  staffId: string;
  displayName: string;
  avatarUrl: string | null;
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
    private readonly staffService: StaffService,
    private readonly emailService: EmailService,
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
      avatarUrl: user.avatarUrl ?? null,
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
  private async generateTokensForOwner(
    user: User,
    options: { rotating?: boolean } = {},
  ): Promise<TokenPair> {
    const payload: OwnerPayload = {
      type: 'owner',
      userId: user.id,
      email: user.email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      // sub is added here so jwt-refresh.strategy can read the standard JWT subject claim
      this.jwtService.signAsync(
        { ...payload, sub: user.id },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      ),
    ]);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    // On refresh-triggered rotation, keep the token being replaced around as
    // `previousRefreshToken` for the grace window (see refreshTokens()). A fresh
    // login/register instead clears it outright — there's no in-flight request
    // racing on the old token in that case.
    await this.userRepository.update(
      user.id,
      options.rotating
        ? {
            previousRefreshToken: user.refreshToken,
            refreshTokenRotatedAt: new Date(),
            refreshToken: hashedRefreshToken,
          }
        : {
            refreshToken: hashedRefreshToken,
            previousRefreshToken: null,
            refreshTokenRotatedAt: null,
          },
    );

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

    // A verified account owns this email — no reclaiming it.
    if (existingUser?.emailVerified) {
      this.logger.warn(
        { email: registerDto.email },
        'Register rejected because user already exists',
      );
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS);

    let savedUser: User;
    if (existingUser) {
      // Reclaim: the prior registration for this email was never verified,
      // so it never gained any real capability. Whoever proves ownership of
      // the inbox by clicking the new verification link takes over.
      existingUser.password = hashedPassword;
      existingUser.firstName = registerDto.firstName ?? existingUser.firstName;
      existingUser.lastName = registerDto.lastName ?? existingUser.lastName;
      existingUser.emailVerified = false;
      existingUser.emailVerificationToken = verificationToken;
      existingUser.emailVerificationExpiresAt = verificationExpiresAt;
      savedUser = await this.userRepository.save(existingUser);
      this.logger.warn({ userId: savedUser.id }, 'Unverified account reclaimed by new registrant');
    } else {
      const user = this.userRepository.create({
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: Role.OWNER,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpiresAt,
      });
      savedUser = await this.userRepository.save(user);
    }

    this.emailService.sendVerificationEmail(savedUser.email, verificationToken);

    const tokens = await this.generateTokensForOwner(savedUser);
    this.logger.info({ userId: savedUser.id }, 'User registered successfully');

    return {
      tokens,
      user: this.buildAuthUser(savedUser),
    };
  }

  async verifyEmail(token: string): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.userRepository.update(user.id, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
    });

    this.logger.info({ userId: user.id }, 'Email verified');

    return { success: true };
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
    business: { id: string; name: string; slug: string };
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

    return {
      business: { id: business.id, name: business.name, slug: business.slug },
      staff: activeStaff,
    };
  }

  async loginStaffBySlug(
    slug: string,
    identifier: string,
    secret: string,
  ): Promise<{
    tokens: { accessToken: string };
    user: StaffAuthUser;
    requiresPasswordChange?: true;
  }> {
    const business = await this.businessRepository.findOne({
      where: { slug, isActive: true },
    });

    if (!business) {
      this.logger.warn({ slug }, 'loginStaffBySlug: slug not found');
      throw new UnauthorizedException('Invalid credentials');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier,
    );
    const staff = await this.staffRepository.findOne({
      where: isUuid
        ? { businessId: business.id, id: identifier, isActive: true }
        : { businessId: business.id, email: identifier.trim().toLowerCase(), isActive: true },
      relations: { business: true },
    });

    if (!staff) {
      this.logger.warn({ slug, identifier }, 'loginStaffBySlug: staff not found');
      throw new UnauthorizedException('Invalid credentials');
    }

    let authenticatedStaff: Staff;

    if (staff.authType === StaffAuthType.PIN) {
      // Route through the same lockout-aware verifier as every other PIN
      // entry point — otherwise this endpoint bypasses PIN lockout entirely.
      authenticatedStaff = await this.staffService.verifyPinOrThrow(business.id, staff.id, secret);
    } else if (staff.passwordHash) {
      const passwordOk = await bcrypt.compare(secret, staff.passwordHash);
      if (!passwordOk) {
        this.logger.warn({ slug, staffId: staff.id }, 'loginStaffBySlug: secret mismatch');
        throw new UnauthorizedException('Invalid credentials');
      }
      authenticatedStaff = staff;
    } else {
      this.logger.warn({ slug, staffId: staff.id }, 'loginStaffBySlug: no credential configured');
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: StaffPayload = {
      type: 'staff',
      staffId: authenticatedStaff.id,
      businessId: authenticatedStaff.businessId,
      role: authenticatedStaff.role,
    };

    if (authenticatedStaff.mustChangePassword) {
      const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '1h' });
      this.logger.info(
        { staffId: authenticatedStaff.id },
        'Staff authenticated but must change password',
      );
      return {
        requiresPasswordChange: true,
        tokens: { accessToken },
        user: this.buildStaffUser(authenticatedStaff),
      };
    }

    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '24h' });
    this.logger.info(
      { staffId: authenticatedStaff.id, businessId: authenticatedStaff.businessId },
      'Staff authenticated via slug',
    );

    return { tokens: { accessToken }, user: this.buildStaffUser(authenticatedStaff) };
  }

  private buildStaffUser(staff: Staff): StaffAuthUser {
    return {
      type: 'staff',
      staffId: staff.id,
      displayName: staff.displayName,
      avatarUrl: staff.avatarUrl ?? null,
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

    const matchesCurrent = await bcrypt.compare(incomingRefreshToken, user.refreshToken);

    // A token that just lost a rotation race is still accepted for a short grace
    // window — otherwise a second tab refreshing on the same pre-rotation cookie
    // (both fire around the same access-token expiry) reads as token reuse and
    // kills a perfectly legitimate session.
    const withinGraceWindow =
      !!user.previousRefreshToken &&
      !!user.refreshTokenRotatedAt &&
      Date.now() - user.refreshTokenRotatedAt.getTime() < REFRESH_TOKEN_GRACE_WINDOW_MS;
    const matchesPrevious =
      !matchesCurrent && withinGraceWindow
        ? await bcrypt.compare(incomingRefreshToken, user.previousRefreshToken as string)
        : false;

    if (!matchesCurrent && !matchesPrevious) {
      // Mismatch outside any grace window — a genuine reuse attempt (e.g. a stolen,
      // already-rotated token replayed later). Invalidate all sessions defensively.
      await this.userRepository.update(userId, {
        refreshToken: null,
        previousRefreshToken: null,
        refreshTokenRotatedAt: null,
      });
      this.logger.warn(
        { userId },
        'Refresh token mismatch — possible reuse attack, sessions cleared',
      );
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // generateTokensForOwner atomically rotates: the current hash moves to
    // previousRefreshToken (kept for the grace window) and the new hash takes its place.
    const tokens = await this.generateTokensForOwner(user, { rotating: true });

    this.logger.debug({ userId: user.id }, 'Tokens refreshed');

    return {
      tokens,
      user: this.buildAuthUser(user),
    };
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      refreshToken: null,
      previousRefreshToken: null,
      refreshTokenRotatedAt: null,
    });
    this.logger.info({ userId }, 'User logged out');
  }

  async lookupStaffByEmployeeId(
    employeeId: string,
    businessId: string,
  ): Promise<{ id: string; displayName: string; role: StaffRole; avatarUrl: string | null }> {
    const staff = await this.staffRepository.findOne({
      where: { employeeId, businessId, isActive: true },
    });

    if (!staff) {
      throw new NotFoundException('Employee ID not found');
    }

    if (staff.pinLockedUntil && staff.pinLockedUntil > new Date()) {
      throw new HttpException({ message: 'Account locked' }, HttpStatus.LOCKED);
    }

    return {
      id: staff.id,
      displayName: staff.displayName,
      role: staff.role,
      avatarUrl: staff.avatarUrl ?? null,
    };
  }

  async loginStaffWithPin(
    staffId: string,
    pin: string,
    businessId: string,
    ip?: string,
  ): Promise<{ tokens: { accessToken: string }; user: StaffAuthUser }> {
    // Lockout state and PIN verification live in StaffService.verifyPinOrThrow
    // so this can't be bypassed by calling a different staff-login endpoint.
    const staff = await this.staffService.verifyPinOrThrow(businessId, staffId, pin);

    await this.staffRepository.update(staff.id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip ?? null,
    });

    const payload: StaffPayload = {
      type: 'staff',
      staffId: staff.id,
      businessId: staff.businessId,
      role: staff.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '24h' });
    this.logger.info({ staffId: staff.id, businessId }, 'Staff authenticated via PIN');

    return { tokens: { accessToken }, user: this.buildStaffUser(staff) };
  }
}
