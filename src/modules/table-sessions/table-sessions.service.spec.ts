import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TableSessionsService } from './table-sessions.service';
import { TableSession } from './table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';

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
