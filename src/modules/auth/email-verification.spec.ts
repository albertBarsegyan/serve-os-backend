import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { User } from '@modules/users/entities/user.entity';
import { Role } from '@common/enums/role.enum';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

/**
 * Regression coverage for Zorologic finding ServerOS-001 (Finding 2):
 * registration created a fully usable, unverified account and nothing
 * gated sensitive actions on verification status.
 */

function makeStatefulUserRepo() {
  const records = new Map<string, Partial<User>>();
  let nextId = 1;

  const findOne = jest.fn(({ where }: { where: Record<string, unknown> }) => {
    const all = Array.from(records.values());
    if (where.id !== undefined) {
      return Promise.resolve((records.get(where.id as string) as User) ?? null);
    }
    if (where.email !== undefined) {
      return Promise.resolve((all.find((u) => u.email === where.email) as User) ?? null);
    }
    if (where.emailVerificationToken !== undefined) {
      return Promise.resolve(
        (all.find((u) => u.emailVerificationToken === where.emailVerificationToken) as User) ??
          null,
      );
    }
    return Promise.resolve(null);
  });

  const create = jest.fn((partial: Partial<User>) => ({ id: `user-${nextId++}`, ...partial }));

  const save = jest.fn((entity: Partial<User>) => {
    const id = entity.id ?? `user-${nextId++}`;
    const merged = { ...(records.get(id) ?? {}), ...entity, id };
    records.set(id, merged);
    return Promise.resolve(merged as User);
  });

  const update = jest.fn((id: string, partial: Record<string, unknown>) => {
    const existing = records.get(id);
    if (existing) records.set(id, { ...existing, ...partial });
    return Promise.resolve({ affected: 1 });
  });

  return { findOne, create, save, update, records };
}

function buildAuthService(userRepo: ReturnType<typeof makeStatefulUserRepo>) {
  const emailService = { sendVerificationEmail: jest.fn(), sendStaffInviteEmail: jest.fn() };
  const jwtServiceStub = {
    sign: jest.fn(() => 'jwt'),
    signAsync: jest.fn(() => Promise.resolve('jwt')),
  };
  const loggerStub = { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };

  const authService = new AuthService(
    userRepo as never,
    {} as never, // staffRepository (unused by register/verifyEmail)
    {} as never, // businessRepository (unused)
    jwtServiceStub as never,
    { get: jest.fn() } as never,
    loggerStub as never,
    {} as never, // staffService (unused by register/verifyEmail)
    emailService as never,
  );

  return { authService, emailService };
}

describe('Registration creates an unverified account and sends a verification email', () => {
  it('sets emailVerified=false and sends a verification email on fresh registration', async () => {
    const userRepo = makeStatefulUserRepo();
    const { authService, emailService } = buildAuthService(userRepo);

    const { user } = await authService.register({
      email: 'owner@example.com',
      password: 'password123',
      firstName: 'Ann',
      lastName: 'Owner',
    });

    expect(user.type).toBe('owner');
    const stored = Array.from(userRepo.records.values())[0];
    expect(stored.emailVerified).toBe(false);
    expect(stored.emailVerificationToken).toEqual(expect.any(String));
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      'owner@example.com',
      stored.emailVerificationToken,
    );
  });

  it('rejects registration when the email already belongs to a VERIFIED account', async () => {
    const userRepo = makeStatefulUserRepo();
    await userRepo.save({
      id: 'existing-1',
      email: 'taken@example.com',
      password: 'hash',
      role: Role.OWNER,
      emailVerified: true,
    });
    const { authService } = buildAuthService(userRepo);

    await expect(
      authService.register({ email: 'taken@example.com', password: 'password123' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('Email verification token flow', () => {
  it('a valid token marks the account verified and clears the token', async () => {
    const userRepo = makeStatefulUserRepo();
    const { authService } = buildAuthService(userRepo);

    await authService.register({ email: 'owner2@example.com', password: 'password123' });
    const stored = Array.from(userRepo.records.values())[0];
    const token = stored.emailVerificationToken as string;

    const result = await authService.verifyEmail(token);
    expect(result.success).toBe(true);

    const updated = userRepo.records.get(stored.id as string);
    expect(updated?.emailVerified).toBe(true);
    expect(updated?.emailVerificationToken).toBeNull();
  });

  it('rejects an invalid token', async () => {
    const userRepo = makeStatefulUserRepo();
    const { authService } = buildAuthService(userRepo);

    await expect(authService.verifyEmail('does-not-exist')).rejects.toThrow(BadRequestException);
  });

  it('rejects an expired token', async () => {
    const userRepo = makeStatefulUserRepo();
    const { authService } = buildAuthService(userRepo);

    await authService.register({ email: 'owner3@example.com', password: 'password123' });
    const stored = Array.from(userRepo.records.values())[0];
    userRepo.records.set(stored.id as string, {
      ...stored,
      emailVerificationExpiresAt: new Date(Date.now() - 1000),
    });

    await expect(authService.verifyEmail(stored.emailVerificationToken as string)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a reused (already-consumed) token', async () => {
    const userRepo = makeStatefulUserRepo();
    const { authService } = buildAuthService(userRepo);

    await authService.register({ email: 'owner4@example.com', password: 'password123' });
    const stored = Array.from(userRepo.records.values())[0];
    const token = stored.emailVerificationToken as string;

    await authService.verifyEmail(token);
    await expect(authService.verifyEmail(token)).rejects.toThrow(BadRequestException);
  });
});

describe('Reclaiming an unverified account', () => {
  it('lets a new registrant overwrite an account that was never verified', async () => {
    const userRepo = makeStatefulUserRepo();
    const { authService: firstRegistrant } = buildAuthService(userRepo);

    // An attacker (or squatter) pre-registers someone else's email but never verifies it.
    await firstRegistrant.register({ email: 'victim@example.com', password: 'attacker-pass' });
    const squatted = Array.from(userRepo.records.values())[0];
    expect(squatted.emailVerified).toBe(false);

    // The real owner registers with the same email.
    const { authService: realOwner } = buildAuthService(userRepo);
    const { user } = await realOwner.register({
      email: 'victim@example.com',
      password: 'real-owner-pass',
      firstName: 'Real',
    });

    expect(user.type).toBe('owner');
    const reclaimed = userRepo.records.get(squatted.id as string);
    expect(reclaimed?.emailVerified).toBe(false); // still requires verification
    expect(reclaimed?.firstName).toBe('Real');
    // Only one account exists for the email — it was overwritten, not duplicated.
    expect(userRepo.records.size).toBe(1);
  });

  it('does NOT allow reclaiming an already-verified account', async () => {
    const userRepo = makeStatefulUserRepo();
    await userRepo.save({
      id: 'verified-1',
      email: 'legit@example.com',
      password: 'hash',
      role: Role.OWNER,
      emailVerified: true,
    });
    const { authService } = buildAuthService(userRepo);

    await expect(
      authService.register({ email: 'legit@example.com', password: 'attacker-pass' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('EmailVerifiedGuard blocks sensitive actions until verified', () => {
  function makeGuard(userRepo: ReturnType<typeof makeStatefulUserRepo>) {
    return new EmailVerifiedGuard(userRepo as never);
  }

  function makeContext(user: unknown) {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as never;
  }

  it('blocks an owner whose email is not verified', async () => {
    const userRepo = makeStatefulUserRepo();
    await userRepo.save({ id: 'o1', email: 'a@example.com', emailVerified: false });
    const guard = makeGuard(userRepo);

    await expect(guard.canActivate(makeContext({ type: 'owner', userId: 'o1' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows an owner whose email is verified', async () => {
    const userRepo = makeStatefulUserRepo();
    await userRepo.save({ id: 'o2', email: 'b@example.com', emailVerified: true });
    const guard = makeGuard(userRepo);

    await expect(guard.canActivate(makeContext({ type: 'owner', userId: 'o2' }))).resolves.toBe(
      true,
    );
  });

  it('does not gate staff principals', async () => {
    const userRepo = makeStatefulUserRepo();
    const guard = makeGuard(userRepo);

    await expect(
      guard.canActivate(makeContext({ type: 'staff', staffId: 's1', businessId: 'b1' })),
    ).resolves.toBe(true);
  });
});
