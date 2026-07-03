import { KitchenGateway } from './kitchen.gateway';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';

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
    );
    gateway.server = server as never;
  });

  it('emitPaymentFailed broadcasts to session and business rooms with the reason', () => {
    gateway.emitPaymentFailed(baseOrder as never, 'card declined');

    const rooms = emitted.map((e) => e.room);
    expect(rooms).toEqual(expect.arrayContaining(['session:session-token', 'business:biz-1']));
    expect(rooms).not.toContain('kitchen:biz-1');
    for (const e of emitted) {
      expect(e.event).toBe('order:payment-failed');
      expect(e.payload).toEqual(
        expect.objectContaining({
          orderId: 'order-1',
          businessId: 'biz-1',
          reason: 'card declined',
        }),
      );
    }
  });

  it('emitOrderRefunded broadcasts to session, business, and kitchen rooms with the refundId', () => {
    const order = { ...baseOrder, status: OrderStatus.REFUNDED };
    gateway.emitOrderRefunded(order as never, 'refund-123');

    const rooms = emitted.map((e) => e.room);
    expect(rooms).toEqual(
      expect.arrayContaining(['session:session-token', 'business:biz-1', 'kitchen:biz-1']),
    );
    for (const e of emitted) {
      expect(e.event).toBe('order:refunded');
      expect(e.payload).toEqual(
        expect.objectContaining({
          orderId: 'order-1',
          businessId: 'biz-1',
          refundId: 'refund-123',
        }),
      );
    }
  });

  it('emitOrderServed broadcasts to the session room, not just business', () => {
    const order = { ...baseOrder, status: OrderStatus.DELIVERED };
    gateway.emitOrderServed(order as never);

    const rooms = emitted.map((e) => e.room);
    expect(rooms).toEqual(expect.arrayContaining(['session:session-token', 'business:biz-1']));
    for (const e of emitted) {
      expect(e.event).toBe('order:served');
    }
  });

  it('emitOrderServed does not touch the session room when there is no active table session', () => {
    const order = { ...baseOrder, status: OrderStatus.DELIVERED, tableSession: null };
    gateway.emitOrderServed(order as never);

    const rooms = emitted.map((e) => e.room);
    expect(rooms).toEqual(['business:biz-1']);
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
