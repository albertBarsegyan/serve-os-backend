import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { TableSessionsService } from './table-sessions.service';
import { TableSession } from './table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { KitchenGateway } from '@modules/kitchen/kitchen.gateway';

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
