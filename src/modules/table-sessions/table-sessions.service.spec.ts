import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { TableSessionsService } from './table-sessions.service';
import { TableSession } from './table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';
import { Payment } from '@modules/payments/entities/payment.entity';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { KitchenGateway } from '@modules/kitchen/kitchen.gateway';
import { TipBasis } from './dto/create-tip.dto';

const mockRepo = <T>() => ({
  findOne: jest.fn<Promise<T | null>, [unknown]>(),
  save: jest.fn<Promise<T>, [unknown]>(),
  create: jest.fn<T, [unknown]>(),
  update: jest.fn(),
  count: jest.fn(),
  find: jest.fn(),
});

describe('TableSessionsService.resumeByToken', () => {
  let service: TableSessionsService;
  let sessionRepo: ReturnType<typeof mockRepo<TableSession>>;
  let tableRepo: ReturnType<typeof mockRepo<Table>>;
  let businessRepo: ReturnType<typeof mockRepo<Business>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableSessionsService,
        { provide: getRepositoryToken(TableSession), useFactory: mockRepo },
        { provide: getRepositoryToken(Table), useFactory: mockRepo },
        { provide: getRepositoryToken(Business), useFactory: mockRepo },
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        { provide: KitchenGateway, useValue: { emitSessionClosed: jest.fn() } },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<TableSessionsService>(TableSessionsService);
    sessionRepo = module.get(getRepositoryToken(TableSession));
    tableRepo = module.get(getRepositoryToken(Table));
    businessRepo = module.get(getRepositoryToken(Business));
  });

  it('returns session data for a valid active non-expired token', async () => {
    const token = 'a'.repeat(64);
    const session = {
      id: 'session-uuid-1',
      sessionToken: token,
      isActive: true,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      tableId: 'table-uuid-1',
      businessId: 'business-uuid-1',
    } as TableSession;
    const table = { id: 'table-uuid-1', number: 5 } as Table;
    const business = {
      id: 'business-uuid-1',
      name: 'Test Restaurant',
      logoUrl: null,
      paymentMethods: [{ method: 'CASH', isActive: true, deletedAt: null }],
    } as unknown as Business;

    sessionRepo.findOne.mockResolvedValue(session);
    tableRepo.findOne.mockResolvedValue(table);
    businessRepo.findOne.mockResolvedValue(business);

    const result = await service.resumeByToken(token);

    expect(result.sessionToken).toBe(token);
    expect(result.tableSessionId).toBe('session-uuid-1');
    expect(result.tableName).toBe('Table 5');
    expect(result.businessName).toBe('Test Restaurant');
    expect(result.paymentMethods).toHaveLength(1);
    expect(result.paymentMethods[0].method).toBe('CASH');
  });

  it('throws NotFoundException when token is unknown or session is inactive', async () => {
    sessionRepo.findOne.mockResolvedValue(null);

    await expect(service.resumeByToken('invalid-token')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when session is expired', async () => {
    const session = {
      id: 'session-uuid-2',
      sessionToken: 'b'.repeat(64),
      isActive: true,
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
      tableId: 'table-uuid-1',
      businessId: 'business-uuid-1',
    } as TableSession;

    sessionRepo.findOne.mockResolvedValue(session);

    await expect(service.resumeByToken('b'.repeat(64))).rejects.toThrow(NotFoundException);
  });

  it('excludes deleted payment methods from the response', async () => {
    const token = 'c'.repeat(64);
    const session = {
      id: 'session-uuid-3',
      sessionToken: token,
      isActive: true,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      tableId: 'table-uuid-1',
      businessId: 'business-uuid-1',
    } as TableSession;
    const table = { id: 'table-uuid-1', number: 3 } as Table;
    const business = {
      id: 'business-uuid-1',
      name: 'My Place',
      logoUrl: 'https://example.com/logo.png',
      paymentMethods: [
        { method: 'CASH', isActive: true, deletedAt: null },
        { method: 'POS', isActive: true, deletedAt: new Date() }, // soft-deleted
      ],
    } as unknown as Business;

    sessionRepo.findOne.mockResolvedValue(session);
    tableRepo.findOne.mockResolvedValue(table);
    businessRepo.findOne.mockResolvedValue(business);

    const result = await service.resumeByToken(token);

    expect(result.paymentMethods).toHaveLength(1);
    expect(result.paymentMethods[0].method).toBe('CASH');
  });
});

describe('TableSessionsService.scan (multi-session per table)', () => {
  let service: TableSessionsService;
  let sessionRepo: ReturnType<typeof mockRepo<TableSession>>;
  let tableRepo: ReturnType<typeof mockRepo<Table>>;
  let businessRepo: ReturnType<typeof mockRepo<Business>>;
  let dataSource: { manager: { count: jest.Mock; update: jest.Mock } };

  const qrCode = 'qr-code-1';
  const table = {
    id: 'table-uuid-1',
    businessId: 'business-uuid-1',
    number: 5,
    qrCode,
  } as Table;
  const business = {
    id: 'business-uuid-1',
    name: 'Test Restaurant',
    logoUrl: null,
    paymentMethods: [],
  } as unknown as Business;

  beforeEach(async () => {
    dataSource = { manager: { count: jest.fn().mockResolvedValue(1), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableSessionsService,
        { provide: getRepositoryToken(TableSession), useFactory: mockRepo },
        { provide: getRepositoryToken(Table), useFactory: mockRepo },
        { provide: getRepositoryToken(Business), useFactory: mockRepo },
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        {
          provide: KitchenGateway,
          useValue: { emitSessionClosed: jest.fn(), emitSessionOpened: jest.fn() },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<TableSessionsService>(TableSessionsService);
    sessionRepo = module.get(getRepositoryToken(TableSession));
    tableRepo = module.get(getRepositoryToken(Table));
    businessRepo = module.get(getRepositoryToken(Business));

    tableRepo.findOne.mockResolvedValue(table);
    businessRepo.findOne.mockResolvedValue(business);
  });

  it('creates a new active session on a scan with no existing session token', async () => {
    const created = {
      sessionToken: 'new-token',
      id: 'session-1',
      businessId: table.businessId,
      tableId: table.id,
    } as TableSession;

    sessionRepo.create.mockReturnValue(created);
    sessionRepo.save.mockResolvedValue(created);

    const result = await service.scan(qrCode);

    expect(result.sessionToken).toBe('new-token');
    // No token to rejoin with — findOrCreateForTable never even looks for an existing row.
    expect(sessionRepo.findOne).not.toHaveBeenCalled();
    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
    expect(dataSource.manager.update).toHaveBeenCalledWith(
      Table,
      { id: table.id },
      { isReserved: true },
    );
  });

  it("rejoins this device's own session when scanning again with its token", async () => {
    const own = {
      sessionToken: 'own-token',
      id: 'session-1',
      businessId: table.businessId,
      tableId: table.id,
      isActive: true,
    } as TableSession;

    sessionRepo.findOne.mockResolvedValue(own);

    const result = await service.scan(qrCode, 'own-token');

    expect(result.sessionToken).toBe('own-token');
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('creates a separate new session even when the table already has another active session', async () => {
    // A different device's token, or no token at all — either way this scan doesn't match
    // the existing session, so it gets its own rather than joining that one.
    sessionRepo.findOne.mockResolvedValue(null);
    const created = {
      sessionToken: 'second-token',
      id: 'session-2',
      businessId: table.businessId,
      tableId: table.id,
    } as TableSession;
    sessionRepo.create.mockReturnValue(created);
    sessionRepo.save.mockResolvedValue(created);

    const result = await service.scan(qrCode, 'someone-elses-token');

    expect(result.sessionToken).toBe('second-token');
    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
  });
});

describe('TableSessionsService.createTip', () => {
  let service: TableSessionsService;
  let businessRepo: ReturnType<typeof mockRepo<Business>>;

  const session = {
    id: 'session-1',
    businessId: 'business-1',
    tableId: 'table-1',
    sessionToken: 'guest-token',
    isActive: true,
  } as TableSession;

  const otherSession = { ...session, id: 'session-2' };

  const business = {
    id: 'business-1',
    features: [BusinessFeature.TIPS],
  } as unknown as Business;

  const baseOrder = {
    id: 'order-1',
    businessId: 'business-1',
    tableSessionId: 'session-1',
    status: OrderStatus.DELIVERED,
    totalAmount: 20,
    tipAmount: 0,
    updatedAt: new Date(),
  } as Order;

  // Chainable fake mirroring TypeORM's QueryBuilder — createQueryBuilder always returns this
  // same object; getOne/getRawOne are configured per-test via mockResolvedValueOnce.
  function makeQueryBuilder() {
    const qb: Record<string, jest.Mock> = {};
    qb.select = jest.fn().mockReturnValue(qb);
    qb.setLock = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.getOne = jest.fn();
    qb.getRawOne = jest.fn();
    return qb;
  }

  function makeQueryRunner(qb: ReturnType<typeof makeQueryBuilder>) {
    return {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        findOne: jest.fn(),
        create: jest.fn((_entity: unknown, data: unknown) => data),
        save: jest.fn((entity) => Promise.resolve(entity)),
      },
    };
  }

  let qb: ReturnType<typeof makeQueryBuilder>;
  let queryRunner: ReturnType<typeof makeQueryRunner>;
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    qb = makeQueryBuilder();
    queryRunner = makeQueryRunner(qb);
    dataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableSessionsService,
        { provide: getRepositoryToken(TableSession), useFactory: mockRepo },
        { provide: getRepositoryToken(Table), useFactory: mockRepo },
        { provide: getRepositoryToken(Business), useFactory: mockRepo },
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        {
          provide: KitchenGateway,
          useValue: { emitSessionClosed: jest.fn(), emitTipUpdated: jest.fn() },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<TableSessionsService>(TableSessionsService);
    businessRepo = module.get(getRepositoryToken(Business));
    businessRepo.findOne.mockResolvedValue(business);
  });

  const dto = (overrides: Partial<Record<string, unknown>> = {}) => ({
    amount: 500,
    basis: TipBasis.SUBTOTAL,
    idempotencyKey: 'key-1',
    ...overrides,
  });

  it('rejects a session tipping an order it does not own', async () => {
    // The locked row belongs to a different session than the caller's — defense-in-depth
    // for the case where ownership changed between the guard's read and this lock.
    qb.getOne.mockResolvedValueOnce({ ...baseOrder, tableSessionId: otherSession.id });
    queryRunner.manager.findOne.mockResolvedValueOnce(null); // idempotency check

    await expect(service.createTip(session, baseOrder, dto())).rejects.toThrow(ForbiddenException);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('rejects an order belonging to a different business (cross-tenant)', async () => {
    qb.getOne.mockResolvedValueOnce({ ...baseOrder, businessId: 'other-business' });
    queryRunner.manager.findOne.mockResolvedValueOnce(null);

    await expect(service.createTip(session, baseOrder, dto())).rejects.toThrow(ForbiddenException);
  });

  it('rejects tipping a CLOSED order', async () => {
    qb.getOne.mockResolvedValueOnce({ ...baseOrder, status: OrderStatus.CLOSED });
    queryRunner.manager.findOne.mockResolvedValueOnce(null);

    await expect(service.createTip(session, baseOrder, dto())).rejects.toThrow(ConflictException);
  });

  it('requires exactly one of amount or percentage', async () => {
    await expect(
      service.createTip(session, baseOrder, dto({ amount: 500, percentage: 10 })),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createTip(session, baseOrder, dto({ amount: undefined, percentage: undefined })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a tip enabled business feature check', async () => {
    businessRepo.findOne.mockResolvedValueOnce({ ...business, features: [] });
    await expect(service.createTip(session, baseOrder, dto())).rejects.toThrow(ForbiddenException);
  });

  it('rejects a tip over the 200%-of-subtotal cap', async () => {
    qb.getOne.mockResolvedValueOnce(baseOrder); // totalAmount 20 -> cap 4000 minor units
    queryRunner.manager.findOne.mockResolvedValueOnce(null);

    await expect(service.createTip(session, baseOrder, dto({ amount: 5000 }))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('writes a Payment row, recomputes order.tipAmount, and emits to the business room', async () => {
    qb.getOne.mockResolvedValueOnce(baseOrder);
    queryRunner.manager.findOne.mockResolvedValueOnce(null); // no existing payment for this key
    qb.getRawOne.mockResolvedValueOnce({ total: '5.00' }); // SUM after insert

    const gateway = (service as unknown as { kitchenGateway: { emitTipUpdated: jest.Mock } })[
      'kitchenGateway'
    ];

    const result = await service.createTip(session, baseOrder, dto({ amount: 500 }));

    expect(result.tipAmount).toBe(5);
    expect(result.orderId).toBe('order-1');
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tipAmount: 5,
        tipSource: 'guest',
        tipSourceSessionId: 'session-1',
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(gateway.emitTipUpdated).toHaveBeenCalled();
  });

  it('percentage path computes the tip off the order subtotal, not a client-supplied total', async () => {
    qb.getOne.mockResolvedValueOnce(baseOrder); // totalAmount 20.00 -> 2000 minor units
    queryRunner.manager.findOne.mockResolvedValueOnce(null);
    qb.getRawOne.mockResolvedValueOnce({ total: '3.60' });

    const result = await service.createTip(
      session,
      baseOrder,
      dto({ amount: undefined, percentage: 18 }),
    );

    expect(result.tipAmount).toBe(3.6);
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3.6, tipAmount: 3.6 }),
    );
  });

  it('replays an idempotent submission instead of writing a second Payment', async () => {
    qb.getOne.mockResolvedValueOnce(baseOrder);
    const existingPayment = { id: 'payment-existing', orderId: 'order-1' } as Payment;
    queryRunner.manager.findOne.mockResolvedValueOnce(existingPayment);

    const result = await service.createTip(session, baseOrder, dto());

    expect(result.paymentId).toBe('payment-existing');
    // No new Payment/Order save — the replay short-circuits before either.
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('rejects a replayed idempotencyKey pointed at a different order', async () => {
    qb.getOne.mockResolvedValueOnce(baseOrder);
    queryRunner.manager.findOne.mockResolvedValueOnce({
      id: 'payment-existing',
      orderId: 'a-different-order',
    });

    await expect(service.createTip(session, baseOrder, dto())).rejects.toThrow(ConflictException);
  });

  it('recovers gracefully when it loses a concurrent unique-key insert race', async () => {
    qb.getOne.mockResolvedValueOnce(baseOrder);
    queryRunner.manager.findOne
      .mockResolvedValueOnce(null) // pre-insert check: no existing row yet
      .mockResolvedValueOnce({ id: 'payment-winner', orderId: 'order-1' }); // post-conflict lookup

    const conflict = new QueryFailedError('INSERT ...', undefined, {
      code: '23505',
    } as unknown as Error);
    queryRunner.manager.save.mockImplementationOnce(() => Promise.reject(conflict));

    const result = await service.createTip(session, baseOrder, dto());

    expect(result.paymentId).toBe('payment-winner');
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });
});

// Regression tests for the TOCTOU race between refreshLifecycle auto-closing a session and
// OrdersService.createGuestOrder/createFromQr inserting a new order on it: refreshLifecycle
// now locks the session row before counting open orders, so this count can never run in the
// gap between a new order's insert starting and committing (see lockAndReactivateSession in
// OrdersService for the other half of this lock).
describe('TableSessionsService.refreshLifecycle', () => {
  let service: TableSessionsService;
  let kitchenGateway: { emitSessionClosed: jest.Mock };

  const session = {
    id: 'session-1',
    businessId: 'business-1',
    tableId: 'table-1',
    sessionToken: 'guest-token',
    isActive: true,
  } as TableSession;

  function makeQueryBuilder() {
    const qb: Record<string, jest.Mock> = {};
    qb.setLock = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.getOne = jest.fn();
    return qb;
  }

  function makeQueryRunner(qb: ReturnType<typeof makeQueryBuilder>) {
    return {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        count: jest.fn(),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
  }

  let qb: ReturnType<typeof makeQueryBuilder>;
  let queryRunner: ReturnType<typeof makeQueryRunner>;
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    qb = makeQueryBuilder();
    queryRunner = makeQueryRunner(qb);
    dataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) };
    kitchenGateway = { emitSessionClosed: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableSessionsService,
        { provide: getRepositoryToken(TableSession), useFactory: mockRepo },
        { provide: getRepositoryToken(Table), useFactory: mockRepo },
        { provide: getRepositoryToken(Business), useFactory: mockRepo },
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        { provide: KitchenGateway, useValue: kitchenGateway },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<TableSessionsService>(TableSessionsService);
  });

  it('locks the session row before counting open orders', async () => {
    qb.getOne.mockResolvedValue({ ...session });
    queryRunner.manager.count.mockResolvedValue(1);

    await service.refreshLifecycle('session-1');

    expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(queryRunner.manager.count).toHaveBeenCalled();
  });

  it('does not close the session when at least one order is still open', async () => {
    qb.getOne.mockResolvedValue({ ...session });
    queryRunner.manager.count.mockResolvedValue(1);

    await service.refreshLifecycle('session-1');

    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(kitchenGateway.emitSessionClosed).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('closes the session and frees the table when no orders are open', async () => {
    qb.getOne.mockResolvedValue({ ...session });
    queryRunner.manager.count.mockResolvedValue(0);

    await service.refreshLifecycle('session-1');

    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1', isActive: false }),
    );
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      Table,
      { id: 'table-1' },
      { isReserved: false },
    );
    expect(kitchenGateway.emitSessionClosed).toHaveBeenCalledWith(
      'guest-token',
      'session-1',
      'business-1',
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('is a no-op when the session is already inactive', async () => {
    qb.getOne.mockResolvedValue({ ...session, isActive: false });

    await service.refreshLifecycle('session-1');

    expect(queryRunner.manager.count).not.toHaveBeenCalled();
    expect(kitchenGateway.emitSessionClosed).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });
});

describe('TableSessionsService.joinSessions / splitSession', () => {
  let service: TableSessionsService;
  let sessionRepo: ReturnType<typeof mockRepo<TableSession>>;

  const businessId = 'business-1';
  const tableId = 'table-1';
  const waiter = { type: 'staff', staffId: 'staff-1', businessId, role: StaffRole.WAITER } as const;
  const cashier = {
    type: 'staff',
    staffId: 'staff-2',
    businessId,
    role: StaffRole.CASHIER,
  } as const;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableSessionsService,
        { provide: getRepositoryToken(TableSession), useFactory: mockRepo },
        { provide: getRepositoryToken(Table), useFactory: mockRepo },
        { provide: getRepositoryToken(Business), useFactory: mockRepo },
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        {
          provide: KitchenGateway,
          useValue: {
            emitSessionClosed: jest.fn(),
            emitSessionJoined: jest.fn(),
            emitSessionSplit: jest.fn(),
          },
        },
        { provide: DataSource, useValue: { manager: { count: jest.fn(), update: jest.fn() } } },
      ],
    }).compile();

    service = module.get<TableSessionsService>(TableSessionsService);
    sessionRepo = module.get(getRepositoryToken(TableSession));
  });

  it('rejects a staff role that cannot manage sessions', async () => {
    await expect(
      service.joinSessions(businessId, 'session-a', { sourceSessionId: 'session-b' }, cashier),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects joining a session into itself', async () => {
    await expect(
      service.joinSessions(businessId, 'session-a', { sourceSessionId: 'session-a' }, waiter),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects sessions from different tables', async () => {
    sessionRepo.findOne
      .mockResolvedValueOnce({
        id: 'session-a',
        tableId: 'table-1',
        isActive: true,
      } as TableSession)
      .mockResolvedValueOnce({
        id: 'session-b',
        tableId: 'table-2',
        isActive: true,
      } as TableSession);

    await expect(
      service.joinSessions(businessId, 'session-a', { sourceSessionId: 'session-b' }, waiter),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks the source as merged into the target', async () => {
    const target = {
      id: 'session-a',
      tableId,
      mergedIntoSessionId: null,
    } as TableSession;
    const source = { id: 'session-b', tableId, mergedIntoSessionId: null } as TableSession;

    sessionRepo.findOne
      .mockResolvedValueOnce(target) // target lookup
      .mockResolvedValueOnce(source); // source lookup
    sessionRepo.count.mockResolvedValue(0); // source has no children of its own
    sessionRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve(entity as TableSession),
    );

    const root = await service.joinSessions(
      businessId,
      'session-a',
      { sourceSessionId: 'session-b' },
      waiter,
    );

    expect(root.id).toBe('session-a');
    expect(sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-b', mergedIntoSessionId: 'session-a' }),
    );
  });

  it('resolves to the existing root when the target is itself already joined', async () => {
    const root = { id: 'session-root', tableId, mergedIntoSessionId: null } as TableSession;
    const target = {
      id: 'session-a',
      tableId,
      mergedIntoSessionId: 'session-root',
    } as TableSession;
    const source = { id: 'session-b', tableId, mergedIntoSessionId: null } as TableSession;

    sessionRepo.findOne
      .mockResolvedValueOnce(target) // target lookup
      .mockResolvedValueOnce(source) // source lookup
      .mockResolvedValueOnce(root); // resolving target's own mergedIntoSessionId
    sessionRepo.count.mockResolvedValue(0);
    sessionRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve(entity as TableSession),
    );

    const result = await service.joinSessions(
      businessId,
      'session-a',
      { sourceSessionId: 'session-b' },
      waiter,
    );

    expect(result.id).toBe('session-root');
    expect(sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-b', mergedIntoSessionId: 'session-root' }),
    );
  });

  it('rejects re-joining a pair that is already joined together', async () => {
    const target = { id: 'session-a', tableId, mergedIntoSessionId: null } as TableSession;
    const source = { id: 'session-b', tableId, mergedIntoSessionId: 'session-a' } as TableSession;

    sessionRepo.findOne.mockResolvedValueOnce(target).mockResolvedValueOnce(source);

    await expect(
      service.joinSessions(businessId, 'session-a', { sourceSessionId: 'session-b' }, waiter),
    ).rejects.toThrow(BadRequestException);
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('rejects joining a session that already has other sessions merged into it', async () => {
    const target = { id: 'session-a', tableId, mergedIntoSessionId: null } as TableSession;
    const source = { id: 'session-b', tableId, mergedIntoSessionId: null } as TableSession;

    sessionRepo.findOne.mockResolvedValueOnce(target).mockResolvedValueOnce(source);
    sessionRepo.count.mockResolvedValue(1); // source already has a child merged into it

    await expect(
      service.joinSessions(businessId, 'session-a', { sourceSessionId: 'session-b' }, waiter),
    ).rejects.toThrow(BadRequestException);
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('splits a joined session back to standing on its own', async () => {
    const session = { id: 'session-b', tableId, mergedIntoSessionId: 'session-a' } as TableSession;
    sessionRepo.findOne.mockResolvedValue(session);
    sessionRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve(entity as TableSession),
    );

    const result = await service.splitSession(businessId, 'session-b', waiter);

    expect(result.mergedIntoSessionId).toBeNull();
    expect(sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-b', mergedIntoSessionId: null }),
    );
  });

  it('rejects splitting a session that is not joined with anything', async () => {
    const session = { id: 'session-b', tableId, mergedIntoSessionId: null } as TableSession;
    sessionRepo.findOne.mockResolvedValue(session);

    await expect(service.splitSession(businessId, 'session-b', waiter)).rejects.toThrow(
      BadRequestException,
    );
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });
});

describe('TableSessionsService.closeSession', () => {
  let service: TableSessionsService;
  let sessionRepo: ReturnType<typeof mockRepo<TableSession>>;
  let orderRepo: ReturnType<typeof mockRepo<Order>>;
  let kitchenGateway: { emitSessionClosed: jest.Mock };

  const waiter = {
    type: 'staff',
    staffId: 'staff-1',
    businessId: 'business-1',
    role: StaffRole.WAITER,
  } as const;

  beforeEach(async () => {
    kitchenGateway = { emitSessionClosed: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableSessionsService,
        { provide: getRepositoryToken(TableSession), useFactory: mockRepo },
        { provide: getRepositoryToken(Table), useFactory: mockRepo },
        { provide: getRepositoryToken(Business), useFactory: mockRepo },
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        { provide: KitchenGateway, useValue: kitchenGateway },
        {
          provide: DataSource,
          useValue: { manager: { update: jest.fn(), count: jest.fn().mockResolvedValue(0) } },
        },
      ],
    }).compile();

    service = module.get<TableSessionsService>(TableSessionsService);
    sessionRepo = module.get(getRepositoryToken(TableSession));
    orderRepo = module.get(getRepositoryToken(Order));
  });

  it('throws NotFoundException when the session never existed', async () => {
    sessionRepo.findOne.mockResolvedValue(null);

    await expect(service.closeSession('missing-id', waiter)).rejects.toThrow(NotFoundException);
  });

  it('is a no-op (not an error) when the session is already closed', async () => {
    const closed = {
      id: 'session-1',
      businessId: 'business-1',
      isActive: false,
    } as TableSession;
    sessionRepo.findOne.mockResolvedValue(closed);

    const result = await service.closeSession('session-1', waiter);

    expect(result).toBe(closed);
    expect(orderRepo.count).not.toHaveBeenCalled();
    expect(sessionRepo.save).not.toHaveBeenCalled();
    expect(kitchenGateway.emitSessionClosed).not.toHaveBeenCalled();
  });

  it('closes an active session with no blocking orders and emits to both rooms', async () => {
    const session = {
      id: 'session-1',
      businessId: 'business-1',
      tableId: 'table-1',
      sessionToken: 'guest-token',
      isActive: true,
    } as TableSession;
    sessionRepo.findOne.mockResolvedValue(session);
    orderRepo.count.mockResolvedValueOnce(0); // blocking orders
    sessionRepo.count.mockResolvedValueOnce(0); // merged children
    sessionRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve(entity as TableSession),
    );

    const result = await service.closeSession('session-1', waiter);

    expect(result.isActive).toBe(false);
    expect(kitchenGateway.emitSessionClosed).toHaveBeenCalledWith(
      'guest-token',
      'session-1',
      'business-1',
    );
  });
});

describe('TableSessionsService.acknowledgeWaiterCall', () => {
  let service: TableSessionsService;
  let sessionRepo: ReturnType<typeof mockRepo<TableSession>>;
  let kitchenGateway: { emitWaiterAcknowledged: jest.Mock };

  const businessId = 'business-1';
  const waiter = { type: 'staff', staffId: 'staff-1', businessId, role: StaffRole.WAITER } as const;

  beforeEach(async () => {
    kitchenGateway = { emitWaiterAcknowledged: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableSessionsService,
        { provide: getRepositoryToken(TableSession), useFactory: mockRepo },
        { provide: getRepositoryToken(Table), useFactory: mockRepo },
        { provide: getRepositoryToken(Business), useFactory: mockRepo },
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        { provide: KitchenGateway, useValue: kitchenGateway },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<TableSessionsService>(TableSessionsService);
    sessionRepo = module.get(getRepositoryToken(TableSession));
  });

  it('throws NotFoundException for an unknown session', async () => {
    sessionRepo.findOne.mockResolvedValue(null);

    await expect(service.acknowledgeWaiterCall(businessId, 'missing', waiter)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('is a no-op when no call is active', async () => {
    const session = { id: 'session-1', businessId, waiterCallActive: false } as TableSession;
    sessionRepo.findOne.mockResolvedValue(session);

    const result = await service.acknowledgeWaiterCall(businessId, 'session-1', waiter);

    expect(result).toBe(session);
    expect(sessionRepo.save).not.toHaveBeenCalled();
    expect(kitchenGateway.emitWaiterAcknowledged).not.toHaveBeenCalled();
  });

  it('clears an active call and broadcasts the acknowledgement', async () => {
    const session = {
      id: 'session-1',
      businessId,
      tableId: 'table-1',
      waiterCallActive: true,
      waiterCallAt: new Date(),
    } as TableSession;
    sessionRepo.findOne.mockResolvedValue(session);
    sessionRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve(entity as TableSession),
    );

    const result = await service.acknowledgeWaiterCall(businessId, 'session-1', waiter);

    expect(result.waiterCallActive).toBe(false);
    expect(result.waiterCallAt).toBeNull();
    expect(kitchenGateway.emitWaiterAcknowledged).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
    );
  });
});
