import { OrdersService } from './orders.service';
import { OrderTransitionService } from './order-transition.service';
import { OrderStatus } from './entities/order-status.enum';
import { OrderType } from './entities/order-type.enum';
import { OrderPaymentStatus } from '@common/enums/payment.enum';

function mockRepo() {
  return {
    findOne: jest.fn(),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    create: jest.fn((entity: unknown) => entity),
    findAndCount: jest.fn(),
  };
}

describe('OrdersService.recomputeAndAdvance', () => {
  let service: OrdersService;
  let orderRepo: ReturnType<typeof mockRepo>;
  let paymentRepo: ReturnType<typeof mockRepo>;
  let kitchenGateway: { emitOrderPaid: jest.Mock; emitOrderConfirmed: jest.Mock };
  let dataSource: {
    createQueryBuilder: jest.Mock;
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

  beforeEach(() => {
    orderRepo = mockRepo();
    kitchenGateway = { emitPaymentFailed: jest.fn(), emitOrderRefunded: jest.fn() };

    const tableSessionsService = { refreshLifecycle: jest.fn() };
    const dataSource = { query: jest.fn().mockResolvedValue(undefined) };

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
