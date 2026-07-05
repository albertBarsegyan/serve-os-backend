import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DisplayService } from './display.service';
import { Display } from './entities/display.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';
import { hashDisplayToken } from './utils/display-token.util';
import type { AuthPayload } from '@modules/auth/types/auth-payload.type';

const mockRepo = <T>() => ({
  findOne: jest.fn<Promise<T | null>, [unknown]>(),
  find: jest.fn<Promise<T[]>, [unknown]>(),
  save: jest.fn<Promise<T>, [unknown]>(),
  create: jest.fn<T, [unknown]>((entity: unknown) => entity as T),
});

describe('DisplayService', () => {
  let service: DisplayService;
  let displayRepo: ReturnType<typeof mockRepo<Display>>;
  let businessRepo: ReturnType<typeof mockRepo<Business>>;
  let orderRepo: ReturnType<typeof mockRepo<Order>>;

  const OWNER_PAYLOAD: AuthPayload = { type: 'owner', userId: 'owner-1', email: 'o@x.com' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisplayService,
        { provide: getRepositoryToken(Display), useFactory: mockRepo },
        { provide: getRepositoryToken(Business), useFactory: mockRepo },
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'CORS_ORIGIN' ? 'https://app.test' : undefined)),
          },
        },
      ],
    }).compile();

    service = module.get(DisplayService);
    displayRepo = module.get(getRepositoryToken(Display));
    businessRepo = module.get(getRepositoryToken(Business));
    orderRepo = module.get(getRepositoryToken(Order));
  });

  describe('create', () => {
    it('rejects an owner who does not own the business', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', ownerId: 'someone-else' } as Business);

      await expect(
        service.create('biz-1', { name: 'Kitchen TV' }, OWNER_PAYLOAD),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(displayRepo.save).not.toHaveBeenCalled();
    });

    it('stores only the token hash and returns the raw token embedded in the url', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', ownerId: 'owner-1' } as Business);
      displayRepo.save.mockImplementation((d) =>
        Promise.resolve({ id: 'display-1', ...(d as object) } as Display),
      );

      const result = await service.create('biz-1', { name: 'Kitchen TV' }, OWNER_PAYLOAD);

      const savedArg = displayRepo.save.mock.calls[0][0] as Display;
      expect(savedArg.tokenHash).toHaveLength(64); // sha256 hex digest
      expect(result.url).toContain('https://app.test/display/');
      const embeddedToken = result.url.split('/display/')[1];
      expect(hashDisplayToken(embeddedToken)).toBe(savedArg.tokenHash);
      expect(JSON.stringify(result)).not.toContain(savedArg.tokenHash);
    });
  });

  describe('findAll', () => {
    it('never returns the raw token or tokenHash, only revoked status', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', ownerId: 'owner-1' } as Business);
      const createdAt1 = new Date('2026-01-01T00:00:00.000Z');
      const createdAt2 = new Date('2026-01-02T00:00:00.000Z');
      displayRepo.find.mockResolvedValue([
        {
          id: 'd1',
          name: 'Kitchen TV',
          createdAt: createdAt1,
          revokedAt: null,
          tokenHash: 'secret-hash',
        } as Display,
        {
          id: 'd2',
          name: 'Bar TV',
          createdAt: createdAt2,
          revokedAt: new Date(),
          tokenHash: 'another-hash',
        } as Display,
      ]);

      const result = await service.findAll('biz-1', OWNER_PAYLOAD);

      expect(result).toEqual([
        { id: 'd1', name: 'Kitchen TV', createdAt: createdAt1, revoked: false },
        { id: 'd2', name: 'Bar TV', createdAt: createdAt2, revoked: true },
      ]);
      expect(JSON.stringify(result)).not.toContain('secret-hash');
      expect(JSON.stringify(result)).not.toContain('another-hash');
    });
  });

  describe('getPublicSnapshot — token validation', () => {
    it('404s on a garbage token that matches no display', async () => {
      displayRepo.findOne.mockResolvedValue(null);

      await expect(service.getPublicSnapshot('garbage-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('404s on a revoked token — the lookup query excludes revoked rows', async () => {
      displayRepo.findOne.mockResolvedValue(null);

      await expect(service.getPublicSnapshot('revoked-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      const callArg = displayRepo.findOne.mock.calls[0][0] as { where: { tokenHash: string } };
      expect(callArg.where.tokenHash).toBe(hashDisplayToken('revoked-token'));
    });

    it('returns a snapshot for a valid, non-revoked token', async () => {
      displayRepo.findOne.mockResolvedValue({
        id: 'display-1',
        businessId: 'biz-1',
        revokedAt: null,
      } as Display);
      orderRepo.find.mockResolvedValue([]);

      const result = await service.getPublicSnapshot('valid-token');

      expect(result).toEqual({ businessId: 'biz-1', preparing: [], ready: [] });
    });
  });

  describe('getPublicSnapshot — sanitized payload shape', () => {
    it('buckets orders by status and strips PII / payment fields', async () => {
      displayRepo.findOne.mockResolvedValue({
        id: 'display-1',
        businessId: 'biz-1',
        revokedAt: null,
      } as Display);
      orderRepo.find.mockResolvedValue([
        {
          id: 'order-1',
          status: OrderStatus.CONFIRMED,
          table: { number: 4 },
          customerName: 'Jane Doe',
          totalAmount: 99.99,
          tipAmount: 5,
          paymentStatus: 'UNPAID',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          items: [{ quantity: 2, unitPrice: 12.5, product: { name: 'Pizza' } }],
        },
        {
          id: 'order-2',
          status: OrderStatus.READY,
          table: { number: 9 },
          customerName: 'John Smith',
          totalAmount: 15,
          updatedAt: new Date('2026-01-01T00:05:00.000Z'),
          items: [{ quantity: 1, unitPrice: 15, product: { name: 'Salad' } }],
        },
      ] as unknown as Order[]);

      const result = await service.getPublicSnapshot('valid-token');

      expect(result.preparing).toEqual([
        {
          orderId: 'order-1',
          tableNumber: 4,
          status: 'PREPARING',
          items: [{ name: 'Pizza', quantity: 2 }],
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
      expect(result.ready).toEqual([
        {
          orderId: 'order-2',
          tableNumber: 9,
          status: 'READY',
          items: [{ name: 'Salad', quantity: 1 }],
          updatedAt: '2026-01-01T00:05:00.000Z',
        },
      ]);

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('Jane Doe');
      expect(serialized).not.toContain('John Smith');
      expect(serialized).not.toContain('99.99');
      expect(serialized).not.toContain('UNPAID');

      const callArg = orderRepo.find.mock.calls[0][0] as { where: { businessId: string } };
      expect(callArg.where.businessId).toBe('biz-1');
    });
  });
});
