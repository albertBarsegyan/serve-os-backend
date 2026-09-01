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

describe('TableSessionsService.scan (find-or-create + concurrent scans)', () => {
  let service: TableSessionsService;
  let sessionRepo: ReturnType<typeof mockRepo<TableSession>>;
  let tableRepo: ReturnType<typeof mockRepo<Table>>;
  let businessRepo: ReturnType<typeof mockRepo<Business>>;

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

    tableRepo.findOne.mockResolvedValue(table);
    businessRepo.findOne.mockResolvedValue(business);
  });

  it('creates a new active session on the first scan of a table', async () => {
    const created = {
      sessionToken: 'new-token',
      id: 'session-1',
      businessId: table.businessId,
      tableId: table.id,
    } as TableSession;

    sessionRepo.findOne.mockResolvedValue(null);
    sessionRepo.create.mockReturnValue(created);
    sessionRepo.save.mockResolvedValue(created);

    const result = await service.scan(qrCode);

    expect(result.sessionToken).toBe('new-token');
    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
    expect(tableRepo.update).toHaveBeenCalledWith({ id: table.id }, { isReserved: true });
  });

  it('returns the existing active session on a second scan of the same table', async () => {
    const existing = {
      sessionToken: 'existing-token',
      id: 'session-1',
      businessId: table.businessId,
      tableId: table.id,
    } as TableSession;

    sessionRepo.findOne.mockResolvedValue(existing);

    const result = await service.scan(qrCode);

    expect(result.sessionToken).toBe('existing-token');
    expect(sessionRepo.save).not.toHaveBeenCalled();
    expect(tableRepo.update).not.toHaveBeenCalled();
  });

  it('joins the winning session instead of erroring when two scans race to create one', async () => {
    const winner = {
      sessionToken: 'winner-token',
      id: 'session-1',
      businessId: table.businessId,
      tableId: table.id,
    } as TableSession;
    const conflict = new QueryFailedError('INSERT ...', undefined, {
      code: '23505',
    } as unknown as Error);

    // First check sees no active session yet; both requests race to insert.
    // This request loses the DB-level unique index race and falls back to
    // re-fetching the session the other request just created.
    sessionRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    sessionRepo.save.mockRejectedValueOnce(conflict);

    const result = await service.scan(qrCode);

    expect(result.sessionToken).toBe('winner-token');
    expect(tableRepo.update).not.toHaveBeenCalled();
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
