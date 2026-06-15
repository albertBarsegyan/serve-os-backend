import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Staff } from './entities/staff.entity';
import { StaffAuthType } from '@common/enums/staff-auth-type.enum';
import { ROLE_PERMISSION_MAP, StaffPermission } from '@common/enums/staff-permission.enum';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { EmailService } from '@common/services/email.service';
import {
  AcceptInviteDto,
  ChangePasswordDto,
  CreateStaffWithInviteDto,
  CreateStaffWithPasswordDto,
  CreateStaffWithPinDto,
  UpdateStaffDto,
} from './dto';

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

export interface StaffTokenPair {
  accessToken: string;
}

@Injectable()
export class StaffService {
  private readonly PIN_HASH_ROUNDS = 10;
  private readonly EMPLOYEE_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  private async generateUniqueEmployeeId(businessId: string): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const suffix = Array.from(randomBytes(6))
        .map((b) => this.EMPLOYEE_ID_CHARS[b % this.EMPLOYEE_ID_CHARS.length])
        .join('');
      const candidate = `EMP-${suffix}`;
      const existing = await this.staffRepository.findOne({
        where: { businessId, employeeId: candidate },
        withDeleted: true,
      });
      if (!existing) return candidate;
    }
    throw new Error('Failed to generate unique employeeId after 10 attempts');
  }

  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create staff with PIN authentication
   */
  async createWithPin(
    dto: CreateStaffWithPinDto,
    createdByOwnerId: string,
    businessId: string,
  ): Promise<Staff> {
    // Validate pin is exactly 4 digits
    if (!/^\d{4}$/.test(dto.pin)) {
      throw new BadRequestException('PIN must be exactly 4 digits');
    }

    // Hash the PIN
    const hashedPin = await bcrypt.hash(dto.pin, this.PIN_HASH_ROUNDS);
    const employeeId = await this.generateUniqueEmployeeId(businessId);

    const staff = this.staffRepository.create({
      businessId,
      createdByOwnerId,
      displayName: dto.displayName,
      role: dto.role,
      authType: StaffAuthType.PIN,
      pin: hashedPin,
      employeeId,
      isActive: true,
    });

    return this.staffRepository.save(staff);
  }

  /**
   * Create staff with password authentication
   */
  async createWithPassword(
    dto: CreateStaffWithPasswordDto,
    createdByOwnerId: string,
    businessId: string,
  ): Promise<Staff> {
    // Hash the temporary password
    const hashedPassword = await bcrypt.hash(dto.temporaryPassword, this.PIN_HASH_ROUNDS);
    const employeeId = await this.generateUniqueEmployeeId(businessId);

    const staff = this.staffRepository.create({
      businessId,
      createdByOwnerId,
      displayName: dto.displayName,
      role: dto.role,
      authType: StaffAuthType.PASSWORD,
      passwordHash: hashedPassword,
      email: dto.email || null,
      mustChangePassword: true, // Force password change on first login
      employeeId,
      isActive: true,
    });

    return this.staffRepository.save(staff);
  }

  /**
   * Create staff with invite-pending authentication
   */
  async createWithInvite(
    dto: CreateStaffWithInviteDto,
    createdByOwnerId: string,
    businessId: string,
  ): Promise<Staff> {
    const inviteToken = uuidv4();
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setHours(inviteExpiresAt.getHours() + 72); // 72 hours from now
    const employeeId = await this.generateUniqueEmployeeId(businessId);

    const staff = this.staffRepository.create({
      businessId,
      createdByOwnerId,
      displayName: dto.displayName,
      role: dto.role,
      email: dto.email,
      authType: StaffAuthType.INVITE_PENDING,
      inviteToken,
      inviteExpiresAt,
      employeeId,
      isActive: true,
    });

    const savedStaff = await this.staffRepository.save(staff);

    // Send invite email
    this.emailService.sendStaffInviteEmail(dto.email, dto.displayName, inviteToken);

    return savedStaff;
  }

  /**
   * Accept an invite and set password
   */
  async acceptInvite(dto: AcceptInviteDto): Promise<{ success: boolean }> {
    const staff = await this.staffRepository.findOne({
      where: {
        inviteToken: dto.token,
        authType: StaffAuthType.INVITE_PENDING,
      },
    });

    if (!staff) {
      throw new BadRequestException('Invalid invite token');
    }

    if (!staff.inviteExpiresAt || staff.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Invite token has expired');
    }

    // Hash the new password

    // Update staff
    staff.passwordHash = await bcrypt.hash(dto.newPassword, this.PIN_HASH_ROUNDS);
    staff.authType = StaffAuthType.PASSWORD;
    staff.mustChangePassword = false;
    staff.inviteToken = null;
    staff.inviteExpiresAt = null;

    await this.staffRepository.save(staff);

    return { success: true };
  }

  /**
   * Login with PIN
   */
  async loginWithPin(
    businessId: string,
    staffId: string,
    pin: string,
  ): Promise<{ tokens: StaffTokenPair; user: StaffAuthUser }> {
    const staff = await this.staffRepository.findOne({
      where: {
        id: staffId,
        businessId,
        authType: StaffAuthType.PIN,
        isActive: true,
      },
      relations: { business: true },
    });

    if (!staff) {
      throw new BadRequestException('Staff member not found or invalid PIN authentication method');
    }

    if (!staff.pin) {
      throw new BadRequestException('PIN not set for this staff member');
    }

    const isValidPin = await bcrypt.compare(pin, staff.pin);
    if (!isValidPin) {
      throw new BadRequestException('Invalid PIN');
    }

    const payload = {
      staffId: staff.id,
      businessId: staff.businessId,
      role: staff.role,
      authType: staff.authType,
      type: 'staff' as const,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '24h' });

    return { tokens: { accessToken }, user: this.buildStaffUser(staff) };
  }

  /**
   * Login with password/email
   */
  async loginWithPassword(
    email: string,
    password: string,
    businessId: string,
  ): Promise<
    | { tokens: StaffTokenPair; user: StaffAuthUser }
    | { requiresPasswordChange: true; staffId: string; tokens: StaffTokenPair }
  > {
    const staff = await this.staffRepository.findOne({
      where: {
        email,
        businessId,
        isActive: true,
      },
      relations: { business: true },
    });

    if (!staff) {
      throw new BadRequestException('Staff member not found with this email');
    }

    if (
      staff.authType !== StaffAuthType.PASSWORD &&
      staff.authType !== StaffAuthType.INVITE_PENDING
    ) {
      throw new BadRequestException('Invalid login method for this staff member');
    }

    if (!staff.passwordHash) {
      throw new BadRequestException('Password not configured for this staff member');
    }

    const isValidPassword = await bcrypt.compare(password, staff.passwordHash);
    if (!isValidPassword) {
      throw new BadRequestException('Invalid password');
    }

    if (staff.mustChangePassword) {
      const tempPayload = {
        staffId: staff.id,
        businessId: staff.businessId,
        role: staff.role,
        authType: staff.authType,
        type: 'staff' as const,
      };
      const accessToken = this.jwtService.sign(tempPayload, { expiresIn: '1h' });
      return { requiresPasswordChange: true, staffId: staff.id, tokens: { accessToken } };
    }

    const payload = {
      staffId: staff.id,
      businessId: staff.businessId,
      role: staff.role,
      authType: staff.authType,
      type: 'staff' as const,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '24h' });

    return { tokens: { accessToken }, user: this.buildStaffUser(staff) };
  }

  /**
   * Change password for a staff member
   */
  async changePassword(staffId: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    if (!staff.passwordHash) {
      throw new BadRequestException('Staff does not have a password set');
    }

    // Compare old password
    const isValidPassword = await bcrypt.compare(dto.oldPassword, staff.passwordHash);
    if (!isValidPassword) {
      throw new BadRequestException('Old password is incorrect');
    }

    // Hash new password

    staff.passwordHash = await bcrypt.hash(dto.newPassword, this.PIN_HASH_ROUNDS);
    staff.mustChangePassword = false;

    await this.staffRepository.save(staff);

    return { success: true };
  }

  /**
   * Get staff by ID
   */
  async findOne(staffId: string, businessId: string): Promise<Staff> {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId, businessId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff with ID ${staffId} not found`);
    }

    return staff;
  }

  /**
   * Get all staff for a business
   */
  async findAll(businessId: string): Promise<Staff[]> {
    return this.staffRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(staffId: string, businessId: string, dto: UpdateStaffDto): Promise<Staff> {
    await this.findOne(staffId, businessId);
    await this.staffRepository.update({ id: staffId, businessId }, dto);
    return this.findOne(staffId, businessId);
  }

  /**
   * Unlock a PIN-locked staff member
   */
  async unlockStaff(staffId: string, businessId: string): Promise<Staff> {
    const staff = await this.findOne(staffId, businessId);
    staff.pinLockedUntil = null;
    staff.pinFailedAttempts = 0;
    return this.staffRepository.save(staff);
  }

  /**
   * Soft delete a staff member
   */
  async remove(staffId: string, businessId: string): Promise<void> {
    const result = await this.staffRepository.softDelete({
      id: staffId,
      businessId,
    });

    if (result.affected === 0) {
      throw new NotFoundException(`Staff with ID ${staffId} not found`);
    }
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
}
