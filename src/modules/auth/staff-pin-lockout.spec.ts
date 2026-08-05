import * as bcrypt from 'bcrypt';
import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';

// staff.service.ts imports the ESM-only `uuid` package (used only for invite
// tokens, unrelated to PIN login) which the project's Jest transform doesn't
// handle; stub it so this spec can load the real StaffService.
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
import { AuthService } from './auth.service';
import { StaffService } from '@modules/staff/staff.service';
import { Staff } from '@modules/staff/entities/staff.entity';
import { StaffAuthType } from '@common/enums/staff-auth-type.enum';
import { StaffRole } from '@common/enums/staff-role.enum';

/**
 * Regression coverage for Zorologic finding ServerOS-001 (Finding 1): a locked
 * staff account must stay locked no matter which endpoint is used to try the
 * PIN again. Both AuthService and StaffService are wired to the SAME
 * StaffService.verifyPinOrThrow, and this spec proves that by sharing one
 * mock repository "row" across calls made through both services.
 */

const BUSINESS_ID = 'business-1';
const STAFF_ID = 'staff-1';
const CORRECT_PIN = '1234';

function makeStatefulStaffRepo(pinHash: string) {
  const record: Partial<Staff> & Record<string, unknown> = {
    id: STAFF_ID,
    businessId: BUSINESS_ID,
    authType: StaffAuthType.PIN,
    isActive: true,
    pin: pinHash,
    passwordHash: null,
    email: null,
    displayName: 'Test Staffer',
    role: StaffRole.WAITER,
    avatarUrl: null,
    mustChangePassword: false,
    pinFailedAttempts: 0,
    pinLockedUntil: null,
    business: { features: [] } as unknown as Staff['business'],
  };

  const findOne = jest.fn(({ where }: { where: Record<string, unknown> }) => {
    if (where.id !== undefined && where.id !== record.id) return Promise.resolve(null);
    if (where.businessId !== undefined && where.businessId !== record.businessId)
      return Promise.resolve(null);
    if (where.authType !== undefined && where.authType !== record.authType)
      return Promise.resolve(null);
    if (where.isActive !== undefined && where.isActive !== record.isActive)
      return Promise.resolve(null);
    return Promise.resolve({ ...record } as Staff);
  });

  const update = jest.fn((id: string, partial: Record<string, unknown>) => {
    if (id === record.id) Object.assign(record, partial);
    return Promise.resolve({ affected: 1 });
  });

  return { findOne, update, record };
}

function buildServices(pinHash: string) {
  const staffRepo = makeStatefulStaffRepo(pinHash);

  const jwtServiceStub = {
    sign: jest.fn(() => 'staff-jwt'),
    signAsync: jest.fn(() => Promise.resolve('staff-jwt')),
  };

  const staffService = new StaffService(
    staffRepo as never,
    jwtServiceStub as never,
    { sendStaffInviteEmail: jest.fn() } as never,
  );

  const loggerStub = { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };

  const authService = new AuthService(
    {} as never, // userRepository (unused by staff PIN flow)
    staffRepo as never, // staffRepository (used only to write lastLoginAt/Ip)
    {} as never, // businessRepository (unused by staffId-based PIN flow)
    jwtServiceStub as never,
    { get: jest.fn() } as never,
    loggerStub as never,
    staffService,
    { sendVerificationEmail: jest.fn() } as never, // emailService (unused by staff PIN flow)
  );

  return { authService, staffService, staffRepo };
}

describe('Staff PIN lockout is shared across every login entry point', () => {
  let pinHash: string;

  beforeAll(async () => {
    pinHash = await bcrypt.hash(CORRECT_PIN, 10);
  });

  it('locking the account via /auth/staff/pin blocks a correct PIN on /login/pin with 423', async () => {
    const { authService, staffService } = buildServices(pinHash);

    for (let i = 0; i < 3; i++) {
      await expect(authService.loginStaffWithPin(STAFF_ID, '0000', BUSINESS_ID)).rejects.toThrow();
    }

    // Correct PIN on the OTHER endpoint must still be rejected as locked.
    await expect(
      staffService.loginWithPin(BUSINESS_ID, STAFF_ID, CORRECT_PIN),
    ).rejects.toMatchObject({ status: HttpStatus.LOCKED });
  });

  it('failed attempts on one endpoint count toward the same counter as the other', async () => {
    const { authService, staffService, staffRepo } = buildServices(pinHash);

    // 2 failures via the businesses/:id/staff/login/pin endpoint...
    await expect(staffService.loginWithPin(BUSINESS_ID, STAFF_ID, '0000')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(staffService.loginWithPin(BUSINESS_ID, STAFF_ID, '0000')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(staffRepo.record.pinFailedAttempts).toBe(2);

    // ...and the 3rd failure via /auth/staff/pin must trip the SAME counter and lock it.
    await expect(authService.loginStaffWithPin(STAFF_ID, '0000', BUSINESS_ID)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(staffRepo.record.pinFailedAttempts).toBe(3);
    expect(staffRepo.record.pinLockedUntil).not.toBeNull();

    // Now locked — even the slug login (3rd variant) must respect it.
    await expect(
      staffService.loginWithPin(BUSINESS_ID, STAFF_ID, CORRECT_PIN),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('lockout auto-expires and both endpoints accept the correct PIN again afterward', async () => {
    const { authService, staffService, staffRepo } = buildServices(pinHash);

    staffRepo.record.pinFailedAttempts = 3;
    staffRepo.record.pinLockedUntil = new Date(Date.now() - 1000); // already expired

    const result = await staffService.loginWithPin(BUSINESS_ID, STAFF_ID, CORRECT_PIN);
    expect(result.tokens.accessToken).toBe('staff-jwt');
    expect(staffRepo.record.pinFailedAttempts).toBe(0);
    expect(staffRepo.record.pinLockedUntil).toBeNull();

    // The other endpoint sees the reset state too.
    const result2 = await authService.loginStaffWithPin(STAFF_ID, CORRECT_PIN, BUSINESS_ID);
    expect(result2.tokens.accessToken).toBe('staff-jwt');
  });

  it('a correct PIN resets the failure counter, and the reset is visible from the other endpoint', async () => {
    const { authService, staffService, staffRepo } = buildServices(pinHash);

    await expect(staffService.loginWithPin(BUSINESS_ID, STAFF_ID, '0000')).rejects.toThrow();
    await expect(staffService.loginWithPin(BUSINESS_ID, STAFF_ID, '0000')).rejects.toThrow();
    expect(staffRepo.record.pinFailedAttempts).toBe(2);

    await authService.loginStaffWithPin(STAFF_ID, CORRECT_PIN, BUSINESS_ID);
    expect(staffRepo.record.pinFailedAttempts).toBe(0);
  });
});
