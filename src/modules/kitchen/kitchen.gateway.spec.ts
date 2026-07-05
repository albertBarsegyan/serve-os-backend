import { KitchenGateway } from './kitchen.gateway';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';
import { hashDisplayToken } from '@modules/display/utils/display-token.util';

function mockLogger() {
  return { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() } as never;
}

function mockRepo<T>() {
  return { findOne: jest.fn<Promise<T | null>, [unknown]>() };
}

describe('KitchenGateway.handleJoinSession', () => {
  let gateway: KitchenGateway;
  let tableSessionRepo: ReturnType<typeof mockRepo>;
  let joinedRooms: string[];
  let client: { id: string; join: jest.Mock; emit: jest.Mock };

  beforeEach(() => {
    tableSessionRepo = mockRepo();
    joinedRooms = [];
    client = {
      id: 'socket-1',
      join: jest.fn((room: string) => {
        joinedRooms.push(room);
        return Promise.resolve();
      }),
      emit: jest.fn(),
    };

    gateway = new KitchenGateway(
      mockLogger(),
      {} as never,
      tableSessionRepo as never,
      mockRepo() as never,
      mockRepo() as never,
      mockRepo() as never,
    );
  });

  it('rejects a token with no matching active session, without joining the room', async () => {
    tableSessionRepo.findOne.mockResolvedValue(null);

    const result = await gateway.handleJoinSession(client as never, 'guessed-token');

    expect(result).toEqual({ event: 'error', data: 'Unauthorized' });
    expect(client.join).not.toHaveBeenCalled();
    expect(tableSessionRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionToken: 'guessed-token', isActive: true } }),
    );
  });

  it('joins the session room and resyncs the current active order for a valid token', async () => {
    const activeOrder = {
      id: 'order-1',
      status: OrderStatus.IN_KITCHEN,
      tableId: 'table-1',
      table: { number: 4 },
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    tableSessionRepo.findOne.mockResolvedValue({
      sessionToken: 'valid-token',
      isActive: true,
      orders: [activeOrder],
    });

    const result = await gateway.handleJoinSession(client as never, 'valid-token');

    expect(result).toEqual({ event: 'joined', data: 'valid-token' });
    expect(joinedRooms).toContain('session:valid-token');
    expect(client.emit).toHaveBeenCalledWith(
      'order:status-changed',
      expect.objectContaining({
        orderId: 'order-1',
        status: 'IN_KITCHEN',
        customerStatus: 'preparing',
      }),
    );
  });

  it('does not stringify an undefined table number into "undefined"', async () => {
    const activeOrder = {
      id: 'order-1',
      status: OrderStatus.IN_KITCHEN,
      tableId: 'table-1',
      table: { number: undefined },
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    tableSessionRepo.findOne.mockResolvedValue({
      sessionToken: 'valid-token',
      isActive: true,
      orders: [activeOrder],
    });

    await gateway.handleJoinSession(client as never, 'valid-token');

    expect(client.emit).toHaveBeenCalledWith(
      'order:status-changed',
      expect.objectContaining({ tableName: null }),
    );
  });

  it('resyncs a CLOSED order too (not just non-terminal ones) and includes paymentStatus', async () => {
    const closedOrder = {
      id: 'order-1',
      status: OrderStatus.CLOSED,
      paymentStatus: 'PAID',
      tableId: 'table-1',
      table: { number: 4 },
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    tableSessionRepo.findOne.mockResolvedValue({
      sessionToken: 'valid-token',
      isActive: true,
      orders: [closedOrder],
    });

    await gateway.handleJoinSession(client as never, 'valid-token');

    expect(client.emit).toHaveBeenCalledWith(
      'order:status-changed',
      expect.objectContaining({
        orderId: 'order-1',
        status: 'CLOSED',
        customerStatus: 'served',
        paymentStatus: 'PAID',
      }),
    );
  });

  it('picks the most recently updated order when the session has more than one', async () => {
    const olderOrder = {
      id: 'order-old',
      status: OrderStatus.CLOSED,
      paymentStatus: 'PAID',
      tableId: 'table-1',
      table: { number: 4 },
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const newerOrder = {
      id: 'order-new',
      status: OrderStatus.IN_KITCHEN,
      paymentStatus: 'UNPAID',
      tableId: 'table-1',
      table: { number: 4 },
      updatedAt: new Date('2026-01-01T01:00:00.000Z'),
    };
    tableSessionRepo.findOne.mockResolvedValue({
      sessionToken: 'valid-token',
      isActive: true,
      orders: [olderOrder, newerOrder],
    });

    await gateway.handleJoinSession(client as never, 'valid-token');

    expect(client.emit).toHaveBeenCalledWith(
      'order:status-changed',
      expect.objectContaining({ orderId: 'order-new' }),
    );
  });
});

describe('KitchenGateway.handleCallWaiter', () => {
  let gateway: KitchenGateway;
  let tableSessionRepo: ReturnType<typeof mockRepo>;
  let server: { to: jest.Mock };
  let emitted: { room: string; event: string; payload: unknown }[];

  beforeEach(() => {
    tableSessionRepo = mockRepo();
    emitted = [];
    server = {
      to: jest.fn((room: string) => ({
        emit: jest.fn((event: string, payload: unknown) => {
          emitted.push({ room, event, payload });
        }),
      })),
    };

    gateway = new KitchenGateway(
      mockLogger(),
      {} as never,
      tableSessionRepo as never,
      mockRepo() as never,
      mockRepo() as never,
      mockRepo() as never,
    );
    gateway.server = server as never;
  });

  it('does not broadcast for a stale/closed session token', async () => {
    tableSessionRepo.findOne.mockResolvedValue(null);

    await gateway.handleCallWaiter({ sessionToken: 'stale-token' });

    expect(tableSessionRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionToken: 'stale-token', isActive: true } }),
    );
    expect(server.to).not.toHaveBeenCalled();
  });

  it('broadcasts to the business room for an active session', async () => {
    tableSessionRepo.findOne.mockResolvedValue({
      businessId: 'biz-1',
      tableId: 'table-1',
    });

    await gateway.handleCallWaiter({ sessionToken: 'valid-token' });

    expect(emitted).toContainEqual(
      expect.objectContaining({ room: 'business:biz-1', event: 'order:call-waiter' }),
    );
  });
});

describe('KitchenGateway payment-failed / refunded emits', () => {
  let gateway: KitchenGateway;
  let server: { to: jest.Mock };
  let emitted: { room: string; event: string; payload: unknown }[];

  const baseOrder = {
    id: 'order-1',
    businessId: 'biz-1',
    tableId: 'table-1',
    status: OrderStatus.PAYMENT_FAILED,
    tableSession: { sessionToken: 'session-token' },
  };

  beforeEach(() => {
    emitted = [];
    server = {
      to: jest.fn((room: string) => ({
        emit: jest.fn((event: string, payload: unknown) => {
          emitted.push({ room, event, payload });
        }),
      })),
    };

    gateway = new KitchenGateway(
      mockLogger(),
      {} as never,
      mockRepo() as never,
      mockRepo() as never,
      mockRepo() as never,
      mockRepo() as never,
    );
    gateway.server = server as never;
  });

  it('emitPaymentFailed broadcasts to session and business rooms with the reason, plus a display removal', () => {
    gateway.emitPaymentFailed(baseOrder as never, 'card declined');

    const rooms = emitted.map((e) => e.room);
    expect(rooms).toEqual(expect.arrayContaining(['session:session-token', 'business:biz-1']));
    expect(rooms).not.toContain('kitchen:biz-1');

    const lifecycleEmits = emitted.filter((e) => e.room !== 'display:biz-1');
    for (const e of lifecycleEmits) {
      expect(e.event).toBe('order:payment-failed');
      expect(e.payload).toEqual(
        expect.objectContaining({
          orderId: 'order-1',
          businessId: 'biz-1',
          reason: 'card declined',
        }),
      );
    }

    expect(emitted).toContainEqual({
      room: 'display:biz-1',
      event: 'display:order-removed',
      payload: { orderId: 'order-1' },
    });
  });

  it('emitOrderRefunded broadcasts to session, business, and kitchen rooms with the refundId, plus a display removal', () => {
    const order = { ...baseOrder, status: OrderStatus.REFUNDED };
    gateway.emitOrderRefunded(order as never, 'refund-123');

    const rooms = emitted.map((e) => e.room);
    expect(rooms).toEqual(
      expect.arrayContaining(['session:session-token', 'business:biz-1', 'kitchen:biz-1']),
    );

    const lifecycleEmits = emitted.filter((e) => e.room !== 'display:biz-1');
    for (const e of lifecycleEmits) {
      expect(e.event).toBe('order:refunded');
      expect(e.payload).toEqual(
        expect.objectContaining({
          orderId: 'order-1',
          businessId: 'biz-1',
          refundId: 'refund-123',
        }),
      );
    }

    expect(emitted).toContainEqual({
      room: 'display:biz-1',
      event: 'display:order-removed',
      payload: { orderId: 'order-1' },
    });
  });

  it('emitOrderServed broadcasts to the session room, not just business, and removes the order from the display', () => {
    const order = { ...baseOrder, status: OrderStatus.DELIVERED };
    gateway.emitOrderServed(order as never);

    const rooms = emitted.map((e) => e.room);
    expect(rooms).toEqual(expect.arrayContaining(['session:session-token', 'business:biz-1']));

    const lifecycleEmits = emitted.filter((e) => e.room !== 'display:biz-1');
    for (const e of lifecycleEmits) {
      expect(e.event).toBe('order:served');
    }

    expect(emitted).toContainEqual({
      room: 'display:biz-1',
      event: 'display:order-removed',
      payload: { orderId: 'order-1' },
    });
  });

  it('emitOrderServed does not touch the session room when there is no active table session', () => {
    const order = { ...baseOrder, status: OrderStatus.DELIVERED, tableSession: null };
    gateway.emitOrderServed(order as never);

    const rooms = emitted.map((e) => e.room);
    expect(rooms).toEqual(['business:biz-1', 'display:biz-1']);
  });

  it('emitPaymentOpen broadcasts to the session room, not just business', () => {
    const order = { ...baseOrder, status: OrderStatus.DELIVERED };
    gateway.emitPaymentOpen(order as never, 'payment-1', 42);

    const rooms = emitted.map((e) => e.room);
    expect(rooms).toEqual(expect.arrayContaining(['session:session-token', 'business:biz-1']));
    for (const e of emitted) {
      expect(e.event).toBe('order:payment-open');
      expect(e.payload).toEqual(
        expect.objectContaining({ orderId: 'order-1', paymentId: 'payment-1', amount: 42 }),
      );
    }
  });
});

describe('KitchenGateway.handleJoinBusiness — staff liveness + token expiry', () => {
  let gateway: KitchenGateway;
  let jwtService: { verifyAsync: jest.Mock };
  let businessRepo: ReturnType<typeof mockRepo>;
  let staffRepo: ReturnType<typeof mockRepo>;
  let client: {
    id: string;
    handshake: { headers: { cookie?: string } };
    join: jest.Mock;
    disconnect: jest.Mock;
  };

  const STAFF_PAYLOAD = {
    type: 'staff' as const,
    staffId: 'staff-1',
    businessId: 'biz-1',
    role: 'WAITER',
  };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    businessRepo = mockRepo();
    staffRepo = mockRepo();
    client = {
      id: 'socket-1',
      handshake: { headers: { cookie: 'access_token=valid-token' } },
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    };

    gateway = new KitchenGateway(
      mockLogger(),
      jwtService as never,
      mockRepo() as never, // tableSessionRepository
      businessRepo as never,
      staffRepo as never,
      mockRepo() as never, // displayRepository
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects join-business for a staff JWT whose businessId matches but whose account is deactivated', async () => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    jwtService.verifyAsync.mockResolvedValue({ ...STAFF_PAYLOAD, exp });
    // isActive: false / soft-deleted staff never comes back from this query.
    staffRepo.findOne.mockResolvedValue(null);

    const result = await gateway.handleJoinBusiness(client as never, 'biz-1');

    expect(result).toEqual({ event: 'error', data: 'Unauthorized' });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('accepts join-business for an active staff account and disconnects once the token expires', async () => {
    jest.useFakeTimers();
    const exp = Math.floor(Date.now() / 1000) + 1;
    jwtService.verifyAsync.mockResolvedValue({ ...STAFF_PAYLOAD, exp });
    staffRepo.findOne.mockResolvedValue({ id: 'staff-1', businessId: 'biz-1', isActive: true });

    const result = await gateway.handleJoinBusiness(client as never, 'biz-1');

    expect(result).toEqual({ event: 'joined', data: 'biz-1' });
    expect(client.join).toHaveBeenCalledWith('business:biz-1');
    expect(client.disconnect).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1100);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('clears the pending expiry timer on disconnect so it never fires afterwards', async () => {
    jest.useFakeTimers();
    const exp = Math.floor(Date.now() / 1000) + 1;
    jwtService.verifyAsync.mockResolvedValue({ ...STAFF_PAYLOAD, exp });
    staffRepo.findOne.mockResolvedValue({ id: 'staff-1', businessId: 'biz-1', isActive: true });

    await gateway.handleJoinBusiness(client as never, 'biz-1');
    gateway.handleDisconnect(client as never);
    jest.advanceTimersByTime(1100);

    expect(client.disconnect).not.toHaveBeenCalled();
  });
});

describe('KitchenGateway.handleJoinDisplay', () => {
  let gateway: KitchenGateway;
  let displayRepo: ReturnType<typeof mockRepo>;
  let client: { id: string; join: jest.Mock; disconnect: jest.Mock };

  beforeEach(() => {
    displayRepo = mockRepo();
    client = {
      id: 'socket-1',
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    };

    gateway = new KitchenGateway(
      mockLogger(),
      {} as never,
      mockRepo() as never, // tableSessionRepository
      mockRepo() as never, // businessRepository
      mockRepo() as never, // staffRepository
      displayRepo as never,
    );
  });

  it('rejects and disconnects a garbage token, without joining any room', async () => {
    displayRepo.findOne.mockResolvedValue(null);

    const result = await gateway.handleJoinDisplay(client as never, 'garbage-token');

    expect(result).toEqual({ event: 'error', data: 'Unauthorized' });
    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
    const callArg = displayRepo.findOne.mock.calls[0][0] as { where: { tokenHash: string } };
    expect(callArg.where.tokenHash).toBe(hashDisplayToken('garbage-token'));
  });

  it('rejects and disconnects a revoked token — the query already excludes revoked rows', async () => {
    displayRepo.findOne.mockResolvedValue(null);

    const result = await gateway.handleJoinDisplay(client as never, 'revoked-token');

    expect(result).toEqual({ event: 'error', data: 'Unauthorized' });
    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('joins the room for the token-owning business, for a valid non-revoked token', async () => {
    displayRepo.findOne.mockResolvedValue({
      id: 'display-1',
      businessId: 'biz-1',
      revokedAt: null,
    });

    const result = await gateway.handleJoinDisplay(client as never, 'valid-token');

    expect(result).toEqual({ event: 'joined', data: 'biz-1' });
    expect(client.join).toHaveBeenCalledWith('display:biz-1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });
});

describe('KitchenGateway display sanitization', () => {
  let gateway: KitchenGateway;
  let server: { to: jest.Mock };
  let emitted: { room: string; event: string; payload: unknown }[];

  const order = {
    id: 'order-1',
    businessId: 'biz-1',
    status: OrderStatus.IN_KITCHEN,
    table: { number: 7 },
    tableSession: {
      sessionToken: 'session-token',
      customerName: 'Jane Doe',
      customerPhone: '+1234567890',
    },
    customerName: 'Jane Doe',
    totalAmount: 42.5,
    tipAmount: 5,
    paymentStatus: 'UNPAID',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    items: [
      {
        quantity: 2,
        unitPrice: 9.99,
        notes: 'no onions',
        product: { name: 'Burger' },
      },
    ],
  };

  beforeEach(() => {
    emitted = [];
    server = {
      to: jest.fn((room: string) => ({
        emit: jest.fn((event: string, payload: unknown) => {
          emitted.push({ room, event, payload });
        }),
      })),
    };

    gateway = new KitchenGateway(
      mockLogger(),
      {} as never,
      mockRepo() as never,
      mockRepo() as never,
      mockRepo() as never,
      mockRepo() as never,
    );
    gateway.server = server as never;
  });

  it('emits a sanitized display:order-updated payload with no PII or payment fields', () => {
    gateway.emitOrderPreparing(order as never);

    const displayEmit = emitted.find((e) => e.room === 'display:biz-1');
    expect(displayEmit).toBeDefined();
    expect(displayEmit?.event).toBe('display:order-updated');
    expect(displayEmit?.payload).toEqual({
      orderId: 'order-1',
      tableNumber: 7,
      status: 'PREPARING',
      items: [{ name: 'Burger', quantity: 2 }],
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const serialized = JSON.stringify(displayEmit?.payload);
    expect(serialized).not.toContain('Jane Doe');
    expect(serialized).not.toContain('+1234567890');
    expect(serialized).not.toContain('session-token');
    expect(serialized).not.toContain('42.5');
    expect(serialized).not.toContain('9.99');
    expect(serialized).not.toContain('no onions');
  });

  it('buckets a READY order under the READY status', () => {
    const readyOrder = { ...order, status: OrderStatus.READY };
    gateway.emitOrderReady(readyOrder as never);

    const displayEmit = emitted.find((e) => e.room === 'display:biz-1');
    expect((displayEmit?.payload as { status: string }).status).toBe('READY');
  });
});
