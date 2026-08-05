import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { StaffService } from './staff.service';
import { Staff } from './entities/staff.entity';
import { StaffRole } from '@common/enums/staff-role.enum';

// staff.service.ts imports the ESM-only `uuid` package (used only for invite
// tokens, unrelated to email uniqueness) which the project's Jest transform
// doesn't handle; stub it so this spec can load the real StaffService.
jest.mock('uuid', () => ({ v4: () => 'mock-invite-token' }));

/**
 * Regression coverage for Zorologic finding ServerOS-001 (Finding 3): staff
 * creation never checked email uniqueness, so two active staff in the same
 * business could share an email.
 */

function makeStatefulStaffRepo() {
  const records: Partial<Staff>[] = [];
  let nextId = 1;

  const findOne = jest.fn(({ where }: { where: Record<string, unknown> }) => {
    const match = records.find((r) => {
      if (where.businessId !== undefined && r.businessId !== where.businessId) return false;
      if (where.email !== undefined && r.email !== where.email) return false;
      if (where.employeeId !== undefined && r.employeeId !== where.employeeId) return false;
      return true;
    });
    return Promise.resolve((match as Staff) ?? null);
  });

  const create = jest.fn((partial: Partial<Staff>) => ({ id: `staff-${nextId++}`, ...partial }));

  const save = jest.fn((entity: Partial<Staff>) => {
    records.push(entity);
    return Promise.resolve(entity as Staff);
  });

  return { findOne, create, save, records };
}

function buildStaffService(staffRepo: ReturnType<typeof makeStatefulStaffRepo>) {
  const jwtServiceStub = { sign: jest.fn(() => 'jwt'), signAsync: jest.fn() };
  const emailServiceStub = { sendStaffInviteEmail: jest.fn(), sendVerificationEmail: jest.fn() };
  return new StaffService(staffRepo as never, jwtServiceStub as never, emailServiceStub as never);
}

const BUSINESS_ID = 'business-1';
const OWNER_ID = 'owner-1';

describe('Staff email uniqueness within a business (password creation)', () => {
  it('rejects a second staff with an email already in use in the same business', async () => {
    const staffRepo = makeStatefulStaffRepo();
    const service = buildStaffService(staffRepo);

    await service.createWithPassword(
      {
        displayName: 'First Manager',
        role: StaffRole.MANAGER,
        email: 'dup@example.com',
        temporaryPassword: 'temp12345',
      },
      OWNER_ID,
      BUSINESS_ID,
    );

    await expect(
      service.createWithPassword(
        {
          displayName: 'Second Manager',
          role: StaffRole.MANAGER,
          email: 'dup@example.com',
          temporaryPassword: 'temp12345',
        },
        OWNER_ID,
        BUSINESS_ID,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a case-insensitive duplicate ("Name@x.com" vs "name@x.com")', async () => {
    const staffRepo = makeStatefulStaffRepo();
    const service = buildStaffService(staffRepo);

    await service.createWithPassword(
      {
        displayName: 'First',
        role: StaffRole.WAITER,
        email: 'Name@x.com',
        temporaryPassword: 'temp12345',
      },
      OWNER_ID,
      BUSINESS_ID,
    );

    await expect(
      service.createWithPassword(
        {
          displayName: 'Second',
          role: StaffRole.WAITER,
          email: 'name@x.com',
          temporaryPassword: 'temp12345',
        },
        OWNER_ID,
        BUSINESS_ID,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('allows the same email in a DIFFERENT business', async () => {
    const staffRepo = makeStatefulStaffRepo();
    const service = buildStaffService(staffRepo);

    await service.createWithPassword(
      {
        displayName: 'First',
        role: StaffRole.WAITER,
        email: 'shared@example.com',
        temporaryPassword: 'temp12345',
      },
      OWNER_ID,
      BUSINESS_ID,
    );

    await expect(
      service.createWithPassword(
        {
          displayName: 'Other Biz Staff',
          role: StaffRole.WAITER,
          email: 'shared@example.com',
          temporaryPassword: 'temp12345',
        },
        OWNER_ID,
        'business-2',
      ),
    ).resolves.toBeDefined();
  });

  it('still creates staff normally for a unique email, storing it normalized', async () => {
    const staffRepo = makeStatefulStaffRepo();
    const service = buildStaffService(staffRepo);

    const staff = await service.createWithPassword(
      {
        displayName: 'Fresh',
        role: StaffRole.CASHIER,
        email: '  Fresh@Example.com  ',
        temporaryPassword: 'temp12345',
      },
      OWNER_ID,
      BUSINESS_ID,
    );

    expect(staff.email).toBe('fresh@example.com');
  });

  it('returns a conflict when a concurrent insert loses the database unique-index race', async () => {
    const staffRepo = makeStatefulStaffRepo();
    const service = buildStaffService(staffRepo);
    const conflict = new QueryFailedError('INSERT INTO staff ...', undefined, {
      code: '23505',
      constraint: 'UQ_staff_businessId_email',
    } as unknown as Error);
    staffRepo.save.mockRejectedValueOnce(conflict);

    await expect(
      service.createWithPassword(
        {
          displayName: 'Racing Manager',
          role: StaffRole.MANAGER,
          email: 'race@example.com',
          temporaryPassword: 'temp12345',
        },
        OWNER_ID,
        BUSINESS_ID,
      ),
    ).rejects.toThrow(ConflictException);
  });
});

describe('Staff email uniqueness within a business (invite creation)', () => {
  it('rejects an invite for an email already in use in the same business', async () => {
    const staffRepo = makeStatefulStaffRepo();
    const service = buildStaffService(staffRepo);

    await service.createWithInvite(
      { displayName: 'First', role: StaffRole.MANAGER, email: 'invitee@example.com' },
      OWNER_ID,
      BUSINESS_ID,
    );

    await expect(
      service.createWithInvite(
        { displayName: 'Second', role: StaffRole.MANAGER, email: 'invitee@example.com' },
        OWNER_ID,
        BUSINESS_ID,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when the email collides with an account created via the password flow', async () => {
    const staffRepo = makeStatefulStaffRepo();
    const service = buildStaffService(staffRepo);

    await service.createWithPassword(
      {
        displayName: 'Password Staff',
        role: StaffRole.MANAGER,
        email: 'cross@example.com',
        temporaryPassword: 'temp12345',
      },
      OWNER_ID,
      BUSINESS_ID,
    );

    await expect(
      service.createWithInvite(
        { displayName: 'Invite Staff', role: StaffRole.MANAGER, email: 'CROSS@example.com' },
        OWNER_ID,
        BUSINESS_ID,
      ),
    ).rejects.toThrow(ConflictException);
  });
});
