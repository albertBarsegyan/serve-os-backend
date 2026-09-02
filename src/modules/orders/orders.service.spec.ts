import { OrdersService } from './orders.service';
import { OrderTransitionService } from './order-transition.service';
import { OrderStatus } from './entities/order-status.enum';
import { OrderType } from './entities/order-type.enum';
import { OrderPaymentStatus } from '@common/enums/payment.enum';
import { TableSession } from '@modules/table-sessions/table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Product } from '@modules/menu/entities/product.entity';

function mockRepo() {
  return {
    findOne: jest.fn(),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    create: jest.fn((entity: unknown) => entity),
    findAndCount: jest.fn(),
  };
}

/**
 * transitionOrder locks and re-fetches the order row via a queryRunner rather than saving
 * the caller's in-memory copy directly (see orders.service.ts). The lock query and the
 * relation-loading query both go through manager.createQueryBuilder()...getOne(), so the
 * mock's query builder resolves `order` for either call, mirroring "the locked row is the
 * current state of this order".
 */
function mockQueryRunner(order: unknown) {
  // Each call to createQueryBuilder() gets its own chainable mock — transitionOrder makes
  // two calls (one to lock the bare order row, one to load the full relation graph) and
  // tests need to tell them apart.
  const makeQueryBuilder = () => ({
    setLock: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(order),
    // Only recomputeOrderTipAmount's manager.createQueryBuilder(Payment, ...) call reaches
    // this — it sums confirmed tips via SUM(), not the row lock/load queries above.
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
  });
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      createQueryBuilder: jest.fn(makeQueryBuilder),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
        id: 'generated-payment-id',
        ...data,
      })),
    },
  };
}

describe('OrdersService.recomputeAndAdvance', () => {
  let service: OrdersService;
  let orderRepo: ReturnType<typeof mockRepo>;
  let paymentRepo: ReturnType<typeof mockRepo>;
  let kitchenGateway: { emitOrderPaid: jest.Mock; emitOrderConfirmed: jest.Mock };
  let dataSource: {
    createQueryBuilder: jest.Mock;
    createQueryRunner: jest.Mock;
    query: jest.Mock;
  };

  beforeEach(() => {
    orderRepo = mockRepo();
    paymentRepo = mockRepo();
    kitchenGateway = { emitOrderPaid: jest.fn(), emitOrderConfirmed: jest.fn() };

    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    };
    dataSource = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      createQueryRunner: jest.fn(),
      query: jest.fn().mockResolvedValue(undefined),
    };
    (dataSource as unknown as { _qb: typeof queryBuilder })._qb = queryBuilder;

    const tableSessionsService = { refreshLifecycle: jest.fn() };

    service = new OrdersService(
      orderRepo as never,
      mockRepo() as never, // orderItemRepository
      mockRepo() as never, // productRepository
      mockRepo() as never, // businessRepository
      paymentRepo as never,
      mockRepo() as never, // staffRepository
      dataSource as never,
      kitchenGateway as never,
      tableSessionsService as never,
      new OrderTransitionService(),
      {} as never, // providerRegistry
    );
  });

  it('broadcasts order:paid when an online payment auto-closes a TAKEAWAY order', async () => {
    const order = {
      id: 'order-1',
      businessId: 'biz-1',
      type: OrderType.TAKEAWAY,
      status: OrderStatus.READY,
      totalAmount: '20',
      tipAmount: 0,
      paymentStatus: OrderPaymentStatus.PARTIALLY_PAID,
      tableSessionId: null,
    };

    dataSource.createQueryRunner.mockReturnValue(mockQueryRunner(order));
    const qb = (dataSource as unknown as { _qb: { getRawOne: jest.Mock } })._qb;
    qb.getRawOne.mockResolvedValue({ total: '20' });
    paymentRepo.findOne.mockResolvedValue({ id: 'payment-1' });

    const result = await service.recomputeAndAdvance(order as never);

    expect(result.status).toBe(OrderStatus.CLOSED);
    expect(result.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(kitchenGateway.emitOrderPaid).toHaveBeenCalledTimes(1);
    expect(kitchenGateway.emitOrderPaid).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1', status: OrderStatus.CLOSED }),
      'payment-1',
    );
  });

  it('does not transition or broadcast when the order is only partially paid', async () => {
    const order = {
      id: 'order-2',
      businessId: 'biz-1',
      type: OrderType.TAKEAWAY,
      status: OrderStatus.READY,
      totalAmount: '20',
      tipAmount: 0,
      paymentStatus: OrderPaymentStatus.UNPAID,
      tableSessionId: null,
    };

    const qb = (dataSource as unknown as { _qb: { getRawOne: jest.Mock } })._qb;
    qb.getRawOne.mockResolvedValue({ total: '10' });

    const result = await service.recomputeAndAdvance(order as never);

    expect(result.status).toBe(OrderStatus.READY);
    expect(result.paymentStatus).toBe(OrderPaymentStatus.PARTIALLY_PAID);
    expect(kitchenGateway.emitOrderPaid).not.toHaveBeenCalled();
  });
});

describe('OrdersService.markPaymentFailed / refundOrder', () => {
  let service: OrdersService;
  let orderRepo: ReturnType<typeof mockRepo>;
  let kitchenGateway: { emitPaymentFailed: jest.Mock; emitOrderRefunded: jest.Mock };
  let dataSource: { query: jest.Mock; createQueryRunner: jest.Mock };

  beforeEach(() => {
    orderRepo = mockRepo();
    kitchenGateway = { emitPaymentFailed: jest.fn(), emitOrderRefunded: jest.fn() };

    const tableSessionsService = { refreshLifecycle: jest.fn() };
    dataSource = { query: jest.fn().mockResolvedValue(undefined), createQueryRunner: jest.fn() };

    service = new OrdersService(
      orderRepo as never,
      mockRepo() as never, // orderItemRepository
      mockRepo() as never, // productRepository
      mockRepo() as never, // businessRepository
      mockRepo() as never, // paymentRepository
      mockRepo() as never, // staffRepository
      dataSource as never,
      kitchenGateway as never,
      tableSessionsService as never,
      new OrderTransitionService(),
      {} as never, // providerRegistry
    );
  });

  it('markPaymentFailed transitions a DELIVERED order to PAYMENT_FAILED and broadcasts', async () => {
    const order = {
      id: 'order-1',
      businessId: 'biz-1',
      type: OrderType.DINE_IN,
      status: OrderStatus.DELIVERED,
      tableSessionId: null,
      paymentStatus: OrderPaymentStatus.UNPAID,
    };
    dataSource.createQueryRunner.mockReturnValue(mockQueryRunner(order));

    const result = await service.markPaymentFailed(order as never, 'card declined');

    expect(result.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(result.paymentStatus).toBe(OrderPaymentStatus.FAILED);
    expect(kitchenGateway.emitPaymentFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1', status: OrderStatus.PAYMENT_FAILED }),
      'card declined',
    );
  });

  it('markPaymentFailed rejects a transition that is invalid from the current state', async () => {
    const order = {
      id: 'order-2',
      businessId: 'biz-1',
      type: OrderType.DINE_IN,
      status: OrderStatus.CREATED,
      tableSessionId: null,
      paymentStatus: OrderPaymentStatus.UNPAID,
    };
    dataSource.createQueryRunner.mockReturnValue(mockQueryRunner(order));

    await expect(service.markPaymentFailed(order as never, 'card declined')).rejects.toThrow();
    expect(kitchenGateway.emitPaymentFailed).not.toHaveBeenCalled();
  });

  it('refundOrder transitions a CLOSED order to REFUNDED and broadcasts', async () => {
    const order = {
      id: 'order-3',
      businessId: 'biz-1',
      type: OrderType.DINE_IN,
      status: OrderStatus.CLOSED,
      tableSessionId: null,
      paymentStatus: OrderPaymentStatus.PAID,
    };
    orderRepo.findOne.mockResolvedValue(order);
    dataSource.createQueryRunner.mockReturnValue(mockQueryRunner(order));

    const result = await service.refundOrder('biz-1', 'order-3', { refundId: 'refund-123' });

    expect(result.status).toBe(OrderStatus.REFUNDED);
    expect(result.paymentStatus).toBe(OrderPaymentStatus.REFUNDED);
    expect(kitchenGateway.emitOrderRefunded).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-3', status: OrderStatus.REFUNDED }),
      'refund-123',
    );
  });

  it('refundOrder rejects an order that is not CLOSED', async () => {
    const order = {
      id: 'order-4',
      businessId: 'biz-1',
      type: OrderType.DINE_IN,
      status: OrderStatus.DELIVERED,
      tableSessionId: null,
      paymentStatus: OrderPaymentStatus.PAID,
    };
    orderRepo.findOne.mockResolvedValue(order);

    await expect(service.refundOrder('biz-1', 'order-4', {})).rejects.toThrow();
    expect(kitchenGateway.emitOrderRefunded).not.toHaveBeenCalled();
  });
});

describe('OrdersService.retryPayment', () => {
  let service: OrdersService;
  let orderRepo: ReturnType<typeof mockRepo>;
  let businessRepo: ReturnType<typeof mockRepo>;
  let kitchenGateway: { emitOrderServed: jest.Mock; emitPaymentOpen: jest.Mock };
  let dataSource: { query: jest.Mock; createQueryRunner: jest.Mock };

  beforeEach(() => {
    orderRepo = mockRepo();
    businessRepo = mockRepo();
    kitchenGateway = { emitOrderServed: jest.fn(), emitPaymentOpen: jest.fn() };

    const tableSessionsService = { refreshLifecycle: jest.fn() };
    dataSource = { query: jest.fn().mockResolvedValue(undefined), createQueryRunner: jest.fn() };

    service = new OrdersService(
      orderRepo as never,
      mockRepo() as never, // orderItemRepository
      mockRepo() as never, // productRepository
      businessRepo as never,
      mockRepo() as never, // paymentRepository
      mockRepo() as never, // staffRepository
      dataSource as never,
      kitchenGateway as never,
      tableSessionsService as never,
      new OrderTransitionService(),
      {} as never, // providerRegistry
    );
  });

  it('retryPayment returns a PAYMENT_FAILED DINE_IN order to DELIVERED and resets paymentStatus', async () => {
    const order = {
      id: 'order-5',
      businessId: 'biz-1',
      type: OrderType.DINE_IN,
      status: OrderStatus.PAYMENT_FAILED,
      tableSessionId: null,
      paymentStatus: OrderPaymentStatus.FAILED,
    };
    orderRepo.findOne.mockResolvedValue(order);
    dataSource.createQueryRunner.mockReturnValue(mockQueryRunner(order));

    const result = await service.retryPayment('biz-1', 'order-5');

    expect(result.status).toBe(OrderStatus.DELIVERED);
    expect(kitchenGateway.emitOrderServed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-5', status: OrderStatus.DELIVERED }),
    );
  });

  it('retryPayment rejects an order that is not PAYMENT_FAILED', async () => {
    const order = {
      id: 'order-6',
      businessId: 'biz-1',
      type: OrderType.DINE_IN,
      status: OrderStatus.DELIVERED,
      tableSessionId: null,
      paymentStatus: OrderPaymentStatus.UNPAID,
    };
    orderRepo.findOne.mockResolvedValue(order);

    await expect(service.retryPayment('biz-1', 'order-6')).rejects.toThrow();
    expect(kitchenGateway.emitOrderServed).not.toHaveBeenCalled();
  });

  it('retryPayment rejects a TAKEAWAY order (graph has no PAYMENT_FAILED transition for it)', async () => {
    const order = {
      id: 'order-7',
      businessId: 'biz-1',
      type: OrderType.TAKEAWAY,
      status: OrderStatus.PAYMENT_FAILED,
      tableSessionId: null,
      paymentStatus: OrderPaymentStatus.FAILED,
    };
    orderRepo.findOne.mockResolvedValue(order);
    dataSource.createQueryRunner.mockReturnValue(mockQueryRunner(order));

    await expect(service.retryPayment('biz-1', 'order-7')).rejects.toThrow();
    expect(kitchenGateway.emitOrderServed).not.toHaveBeenCalled();
  });
});

describe('OrdersService.confirmOrder', () => {
  let service: OrdersService;
  let orderRepo: ReturnType<typeof mockRepo>;
  let kitchenGateway: { emitOrderConfirmed: jest.Mock };
  let dataSource: { query: jest.Mock; createQueryRunner: jest.Mock };

  beforeEach(() => {
    orderRepo = mockRepo();
    kitchenGateway = { emitOrderConfirmed: jest.fn() };

    const tableSessionsService = { refreshLifecycle: jest.fn() };
    dataSource = { query: jest.fn().mockResolvedValue(undefined), createQueryRunner: jest.fn() };

    service = new OrdersService(
      orderRepo as never,
      mockRepo() as never, // orderItemRepository
      mockRepo() as never, // productRepository
      mockRepo() as never, // businessRepository
      mockRepo() as never, // paymentRepository
      mockRepo() as never, // staffRepository
      dataSource as never,
      kitchenGateway as never,
      tableSessionsService as never,
      new OrderTransitionService(),
      {} as never, // providerRegistry
    );
  });

  // Regression test: transitionOrder used to lock the order row via a single query that
  // joined items/product/kitchenStation/table/waiter/tableSession, which fails against
  // Postgres ("FOR UPDATE cannot be applied to the nullable side of an outer join") whenever
  // any of those optional relations is null. Locking must happen against the bare order row.
  it('confirms a CREATED order whose table, waiter, tableSession and item.product are all null', async () => {
    const order = {
      id: 'order-5',
      businessId: 'biz-1',
      type: OrderType.TAKEAWAY,
      status: OrderStatus.CREATED,
      tableSessionId: null,
      table: null,
      waiter: null,
      tableSession: null,
      items: [{ id: 'item-1', productId: 'prod-1', product: null, quantity: 1 }],
      paymentStatus: OrderPaymentStatus.UNPAID,
    };
    orderRepo.findOne.mockResolvedValue(order);

    const queryRunner = mockQueryRunner(order);
    dataSource.createQueryRunner.mockReturnValue(queryRunner);

    const result = await service.confirmOrder('biz-1', 'order-5', {
      type: 'staff',
      id: 'staff-1',
      role: 'WAITER',
    });

    expect(result.status).toBe(OrderStatus.CONFIRMED);
    // The lock query builder must not attempt any joins — it locks the bare "orders" row only.
    const lockQueryBuilder = queryRunner.manager.createQueryBuilder.mock.results[0].value as {
      setLock: jest.Mock;
      leftJoinAndSelect: jest.Mock;
    };
    expect(lockQueryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(lockQueryBuilder.leftJoinAndSelect).not.toHaveBeenCalled();
    expect(kitchenGateway.emitOrderConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-5', status: OrderStatus.CONFIRMED }),
    );
  });
});

// Regression tests for the check-then-act race between confirming a payment and closing the
// order: both used to be written via separate repositories *before* transitionOrder's locked
// transaction, so a losing race (duplicate confirm click, reconcile poller vs. webhook) could
// leave a payment marked CONFIRMED against an order that never actually closed. The payment
// write now happens inside transitionOrder's own locked transaction (via queryRunner.manager),
// not the injected repository, so it commits or rolls back atomically with the transition.
describe('OrdersService.confirmOrderPayment / processCashPayment', () => {
  let service: OrdersService;
  let orderRepo: ReturnType<typeof mockRepo>;
  let paymentRepo: ReturnType<typeof mockRepo>;
  let businessRepo: ReturnType<typeof mockRepo>;
  let kitchenGateway: { emitOrderPaid: jest.Mock };
  let dataSource: { query: jest.Mock; createQueryRunner: jest.Mock };

  beforeEach(() => {
    orderRepo = mockRepo();
    paymentRepo = mockRepo();
    businessRepo = mockRepo();
    kitchenGateway = { emitOrderPaid: jest.fn() };

    const tableSessionsService = { refreshLifecycle: jest.fn() };
    dataSource = { query: jest.fn().mockResolvedValue(undefined), createQueryRunner: jest.fn() };

    service = new OrdersService(
      orderRepo as never,
      mockRepo() as never, // orderItemRepository
      mockRepo() as never, // productRepository
      businessRepo as never,
      paymentRepo as never,
      mockRepo() as never, // staffRepository
      dataSource as never,
      kitchenGateway as never,
      tableSessionsService as never,
      new OrderTransitionService(),
      {} as never, // providerRegistry
    );
  });

  it('confirmOrderPayment closes the order and confirms the payment atomically via the locked transaction', async () => {
    const order = {
      id: 'order-8',
      businessId: 'biz-1',
      type: OrderType.DINE_IN,
      status: OrderStatus.DELIVERED,
      totalAmount: '20',
      tipAmount: 0,
      tableSessionId: null,
      paymentStatus: OrderPaymentStatus.UNPAID,
    };
    const pendingPayment = {
      id: 'payment-1',
      orderId: 'order-8',
      businessId: 'biz-1',
      status: 'PENDING',
    };
    orderRepo.findOne.mockResolvedValue(order);
    paymentRepo.findOne.mockResolvedValue(pendingPayment);

    const queryRunner = mockQueryRunner(order);
    dataSource.createQueryRunner.mockReturnValue(queryRunner);

    const result = await service.confirmOrderPayment('biz-1', 'order-8', 'staff-1', {});

    expect(result.status).toBe(OrderStatus.CLOSED);
    expect(result.paymentStatus).toBe(OrderPaymentStatus.PAID);
    // The payment is confirmed via the queryRunner's manager (inside the locked transaction),
    // never via the plain injected repository — that's what makes it atomic with the transition.
    expect(paymentRepo.save).not.toHaveBeenCalled();
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'payment-1', status: 'CONFIRMED', confirmedById: 'staff-1' }),
    );
    expect(kitchenGateway.emitOrderPaid).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-8', status: OrderStatus.CLOSED }),
      'payment-1',
    );
  });

  it('confirmOrderPayment rejects when the order is not DELIVERED, without touching the payment', async () => {
    const order = {
      id: 'order-9',
      businessId: 'biz-1',
      type: OrderType.DINE_IN,
      status: OrderStatus.READY,
      tableSessionId: null,
      paymentStatus: OrderPaymentStatus.UNPAID,
    };
    orderRepo.findOne.mockResolvedValue(order);

    await expect(service.confirmOrderPayment('biz-1', 'order-9', 'staff-1', {})).rejects.toThrow();
    expect(paymentRepo.findOne).not.toHaveBeenCalled();
    expect(kitchenGateway.emitOrderPaid).not.toHaveBeenCalled();
  });

  it('processCashPayment creates and confirms the payment atomically via the locked transaction', async () => {
    const order = {
      id: 'order-10',
      businessId: 'biz-1',
      type: OrderType.DINE_IN,
      status: OrderStatus.DELIVERED,
      totalAmount: '15',
      tipAmount: 0,
      tableSessionId: null,
      paymentStatus: OrderPaymentStatus.UNPAID,
    };
    orderRepo.findOne.mockResolvedValue(order);
    businessRepo.findOne.mockResolvedValue({ id: 'biz-1', features: [] });

    const queryRunner = mockQueryRunner(order);
    dataSource.createQueryRunner.mockReturnValue(queryRunner);

    const result = await service.processCashPayment('biz-1', 'order-10', {});

    expect(result.status).toBe(OrderStatus.CLOSED);
    expect(result.paymentStatus).toBe(OrderPaymentStatus.PAID);
    // Created and confirmed through the transaction's manager, never the plain repository —
    // a losing race on the transition rolls this payment creation back with it.
    expect(paymentRepo.save).not.toHaveBeenCalled();
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-10', status: 'CONFIRMED' }),
    );
    expect(kitchenGateway.emitOrderPaid).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-10', status: OrderStatus.CLOSED }),
      expect.any(String),
    );
  });
});

// Regression tests for the TOCTOU race between placing a guest order and refreshLifecycle
// auto-closing the session: createFromQr locks the session row (lockAndReactivateSession)
// before inserting anything, so a session that raced closed between GuestSessionGuard's
// check and this transaction acquiring the lock gets reopened rather than leaving the
// guest's order attached to a closed session (or ejecting them outright).
describe('OrdersService.createFromQr — session reactivation race', () => {
  let service: OrdersService;
  let orderRepo: ReturnType<typeof mockRepo>;
  let kitchenGateway: { emitOrderCreated: jest.Mock };
  let tableSessionsService: { getActiveByToken: jest.Mock; bumpExpiresAt: jest.Mock };
  let dataSource: { createQueryRunner: jest.Mock };

  const table = { id: 'table-1', businessId: 'biz-1' };
  const business = { id: 'biz-1' };
  const product = { id: 'product-1', price: 10 };
  const tableSession = {
    id: 'session-1',
    tableId: 'table-1',
    businessId: 'biz-1',
    sessionToken: 'token-1',
  };
  const dto = { sessionToken: 'token-1', items: [{ productId: 'product-1', quantity: 1 }] };

  // A single queryRunner.manager mock whose createQueryBuilder/findOne/update/create/save
  // branch on the entity class passed in — mirrors what each of createFromQr's calls needs
  // without hard-coding call order.
  function mockManager(opts: { sessionLock: unknown }) {
    return {
      createQueryBuilder: jest.fn((entity: unknown) => {
        if (entity === TableSession) {
          return {
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(opts.sessionLock),
          };
        }
        throw new Error(`unexpected createQueryBuilder(${String(entity)})`);
      }),
      findOne: jest.fn((entity: unknown) => {
        if (entity === Table) return Promise.resolve(table);
        if (entity === Business) return Promise.resolve(business);
        if (entity === Product) return Promise.resolve(product);
        return Promise.resolve(null);
      }),
      // syncTableReservedState's active-session count — a table can carry several
      // concurrent sessions now, so this just needs to be > 0 for these tests.
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve({ id: 'order-1', ...(entity as object) })),
    };
  }

  function mockQueryRunner(manager: ReturnType<typeof mockManager>) {
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager,
    };
  }

  beforeEach(() => {
    orderRepo = mockRepo();
    orderRepo.findOne.mockResolvedValue({ id: 'order-1', status: OrderStatus.CREATED });
    kitchenGateway = { emitOrderCreated: jest.fn() };
    tableSessionsService = {
      getActiveByToken: jest.fn().mockResolvedValue(tableSession),
      bumpExpiresAt: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = { createQueryRunner: jest.fn() };

    service = new OrdersService(
      orderRepo as never,
      mockRepo() as never, // orderItemRepository
      mockRepo() as never, // productRepository
      mockRepo() as never, // businessRepository
      mockRepo() as never, // paymentRepository
      mockRepo() as never, // staffRepository
      dataSource as never,
      kitchenGateway as never,
      tableSessionsService as never,
      new OrderTransitionService(),
      {} as never, // providerRegistry
    );
  });

  it('does not touch an already-active session', async () => {
    const manager = mockManager({ sessionLock: { ...tableSession, isActive: true } });
    dataSource.createQueryRunner.mockReturnValue(mockQueryRunner(manager));

    await service.createFromQr(dto, undefined);

    expect(manager.update).not.toHaveBeenCalled();
  });

  it('reactivates a session that raced closed before this transaction acquired the lock', async () => {
    const manager = mockManager({
      sessionLock: { ...tableSession, isActive: false, closedAt: new Date() },
    });
    dataSource.createQueryRunner.mockReturnValue(mockQueryRunner(manager));

    await service.createFromQr(dto, undefined);

    expect(manager.update).toHaveBeenCalledWith(
      TableSession,
      { id: 'session-1' },
      { isActive: true, closedAt: null },
    );
    expect(manager.update).toHaveBeenCalledWith(Table, { id: 'table-1' }, { isReserved: true });
    expect(kitchenGateway.emitOrderCreated).toHaveBeenCalled();
  });
});
