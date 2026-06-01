import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Staff } from './entities/staff.entity';
import { StaffAuthType } from '@common/enums/staff-auth-type.enum';
import { EmailService } from '@common/services/email.service';
import {
  AcceptInviteDto,
  ChangePasswordDto,
  CreateStaffWithInviteDto,
  CreateStaffWithPasswordDto,
  CreateStaffWithPinDto,
  UpdateStaffDto,
} from './dto';

@Injectable()
export class StaffService {
  private readonly PIN_HASH_ROUNDS = 10;

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

    const staff = this.staffRepository.create({
      businessId,
      createdByOwnerId,
      displayName: dto.displayName,
      role: dto.role,
      authType: StaffAuthType.PIN,
      pin: hashedPin,
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

    const staff = this.staffRepository.create({
      businessId,
      createdByOwnerId,
      displayName: dto.displayName,
      role: dto.role,
      authType: StaffAuthType.PASSWORD,
      passwordHash: hashedPassword,
      email: dto.email || null,
      mustChangePassword: true, // Force password change on first login
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

    const staff = this.staffRepository.create({
      businessId,
      createdByOwnerId,
      displayName: dto.displayName,
      role: dto.role,
      email: dto.email,
      authType: StaffAuthType.INVITE_PENDING,
      inviteToken,
      inviteExpiresAt,
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
    const hashedPassword = await bcrypt.hash(dto.newPassword, this.PIN_HASH_ROUNDS);

    // Update staff
    staff.passwordHash = hashedPassword;
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
  ): Promise<{ accessToken: string }> {
    const staff = await this.staffRepository.findOne({
      where: {
        id: staffId,
        businessId,
        authType: StaffAuthType.PIN,
        isActive: true,
      },
    });

    if (!staff) {
      throw new BadRequestException('Invalid credentials');
    }

    if (!staff.pin) {
      throw new BadRequestException('PIN not set for this staff member');
    }

    // Compare PIN with bcrypt
    const isValidPin = await bcrypt.compare(pin, staff.pin);
    if (!isValidPin) {
      throw new BadRequestException('Invalid credentials');
    }

    // Generate JWT
    const payload = {
      staffId: staff.id,
      businessId: staff.businessId,
      role: staff.role,
      authType: staff.authType,
      type: 'staff' as const,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '24h',
    });

    return { accessToken };
  }

  /**
   * Login with password/email
   */
  async loginWithPassword(
    email: string,
    password: string,
    businessId: string,
  ): Promise<{ accessToken?: string; requiresPasswordChange?: boolean; staffId?: string }> {
    const staff = await this.staffRepository.findOne({
      where: {
        email,
        businessId,
        isActive: true,
      },
    });

    if (!staff) {
      throw new BadRequestException('Invalid credentials');
    }

    if (
      staff.authType !== StaffAuthType.PASSWORD &&
      staff.authType !== StaffAuthType.INVITE_PENDING
    ) {
      throw new BadRequestException('Invalid login method for this staff');
    }

    if (!staff.passwordHash) {
      throw new BadRequestException('Password not set');
    }

    // Compare password with bcrypt
    const isValidPassword = await bcrypt.compare(password, staff.passwordHash);
    if (!isValidPassword) {
      throw new BadRequestException('Invalid credentials');
    }

    // Check if password change is required
    if (staff.mustChangePassword) {
      return {
        requiresPasswordChange: true,
        staffId: staff.id,
      };
    }

    // Generate JWT
    const payload = {
      staffId: staff.id,
      businessId: staff.businessId,
      role: staff.role,
      authType: staff.authType,
      type: 'staff' as const,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '24h',
    });

    return { accessToken };
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
    const hashedPassword = await bcrypt.hash(dto.newPassword, this.PIN_HASH_ROUNDS);

    staff.passwordHash = hashedPassword;
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
      where: { businessId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async update(staffId: string, businessId: string, dto: UpdateStaffDto): Promise<Staff> {
    await this.findOne(staffId, businessId);
    await this.staffRepository.update({ id: staffId, businessId }, dto);
    return this.findOne(staffId, businessId);
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
}
