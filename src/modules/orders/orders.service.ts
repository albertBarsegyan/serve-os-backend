import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ConfirmOrderPaymentDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { Product } from '@modules/menu/entities/product.entity';
import { ActorInfo, KitchenGateway } from '@modules/kitchen/kitchen.gateway';
import { Table } from '@modules/tables/entities/table.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { TableSession } from '@modules/table-sessions/table-session.entity';
import {
  OPEN_ORDER_STATUSES,
  TableSessionsService,
} from '@modules/table-sessions/table-sessions.service';
import { CreateOrderFromQrDto } from './dto/create-order-from-qr.dto';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto';
import { CreateStaffOrderDto } from './dto/create-staff-order.dto';
import { OrderItemModifier } from '@modules/modifiers/entities/order-item-modifier.entity';
import { OrderStatus } from './entities/order-status.enum';
import { OrderType } from './entities/order-type.enum';
import { Business } from '@modules/business/entities/business.entity';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { OrderTransitionService, TransitionActor } from './order-transition.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { Payment } from '@modules/payments/entities/payment.entity';
import {
  CaptureTiming,
  OrderPaymentStatus,
  PaymentMethod,
  PaymentMethodConfig,
  PaymentStatus,
} from '@common/enums/payment.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { ProviderRegistryService } from '@modules/payments/providers/provider-registry.service';

const SYSTEM_ACTOR: ActorInfo = { type: 'system', id: 'system' };

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    private readonly dataSource: DataSource,
    private readonly kitchenGateway: KitchenGateway,
    private readonly tableSessionsService: TableSessionsService,
    private readonly orderTransitionService: OrderTransitionService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {}

  async createFromQr(dto: CreateOrderFromQrDto, headerSessionToken?: string): Promise<Order> {
    const sessionToken = dto.sessionToken ?? headerSessionToken;
    if (!sessionToken) {
      throw new BadRequestException('sessionToken is required');
    }

    const tableSession = await this.tableSessionsService.getActiveByToken(sessionToken);
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const table = await queryRunner.manager.findOne(Table, {
        where: { id: tableSession.tableId, businessId: tableSession.businessId },
      });

      if (!table) {
        throw new NotFoundException('Table not found for session');
      }

      const business = await queryRunner.manager.findOne(Business, {
        where: { id: tableSession.businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found for session');
      }

      let totalAmount = 0;
      const orderItems: OrderItem[] = [];

      for (const itemDto of dto.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: itemDto.productId, businessId: tableSession.businessId },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${itemDto.productId} not found`);
        }

        const modifiers = itemDto.selectedModifiers ?? [];
        const modifierPrice = modifiers.reduce((sum, m) => sum + Number(m.priceAdjustment), 0);
        const unitPrice = Number(product.price) + modifierPrice;
        totalAmount += unitPrice * itemDto.quantity;

        const orderItem = queryRunner.manager.create(OrderItem, {
          productId: product.id,
          quantity: itemDto.quantity,
          unitPrice,
          notes: itemDto.notes,
          selectedModifiers: modifiers.map((m) =>
            queryRunner.manager.create(OrderItemModifier, {
              modifierId: m.modifierId,
              modifierName: m.name,
              priceAdjustment: m.priceAdjustment,
            }),
          ),
        });
        orderItems.push(orderItem);
      }

      const order = queryRunner.manager.create(Order, {
        businessId: tableSession.businessId,
        tableId: tableSession.tableId,
        type: OrderType.DINE_IN,
        status: OrderStatus.CREATED,
        tableSessionId: tableSession.id,
        totalAmount,
      });

      const savedOrder = await queryRunner.manager.save(order);

      for (const item of orderItems) {
        item.order = savedOrder;
      }

      await queryRunner.manager.save(orderItems);
      await queryRunner.commitTransaction();

      const createdOrder = (await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: [
          'items',
          'items.product',
          'items.product.kitchenStation',
          'table',
          'tableSession',
        ],
      })) as Order;

      this.kitchenGateway.emitOrderCreated(createdOrder);

      void this.tableSessionsService.bumpExpiresAt(tableSession.id).catch(() => undefined);

      return createdOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async create(businessId: string, dto: CreateOrderFromQrDto): Promise<Order> {
    return this.createFromQr(dto);
  }

  async createGuestOrder(
    session: TableSession,
    dto: CreateGuestOrderDto,
  ): Promise<{ order: Order; redirectUrl?: string }> {
    const business = await this.businessRepository.findOne({
      where: { id: session.businessId },
      relations: ['paymentMethods'],
    });

    if (!business) throw new NotFoundException('Business not found');

    const pmRecord = (business.paymentMethods ?? []).find(
      (pm) => pm.method === dto.paymentMethod && pm.isActive && !pm.deletedAt,
    );
    if (!pmRecord) {
      throw new BadRequestException(
        `Payment method ${dto.paymentMethod} is not available for this business`,
      );
    }

    const config = pmRecord.config as PaymentMethodConfig | null;
    const captureTiming = config?.captureTiming ?? CaptureTiming.ON_PREMISE;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedOrderId: string;
    try {
      let totalAmount = 0;
      const orderItems: OrderItem[] = [];

      for (const itemDto of dto.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: itemDto.productId, businessId: session.businessId },
        });
        if (!product) throw new NotFoundException(`Product ${itemDto.productId} not found`);

        const modifiers = itemDto.selectedModifiers ?? [];
        const modifierPrice = modifiers.reduce((sum, m) => sum + Number(m.priceAdjustment), 0);
        const unitPrice = Number(product.price) + modifierPrice;
        totalAmount += unitPrice * itemDto.quantity;

        orderItems.push(
          queryRunner.manager.create(OrderItem, {
            productId: product.id,
            quantity: itemDto.quantity,
            unitPrice,
            notes: itemDto.notes,
            selectedModifiers: modifiers.map((m) =>
              queryRunner.manager.create(OrderItemModifier, {
                modifierId: m.modifierId,
                modifierName: m.name,
                priceAdjustment: m.priceAdjustment,
              }),
            ),
          }),
        );
      }

      const order = queryRunner.manager.create(Order, {
        businessId: session.businessId,
        tableId: session.tableId,
        type: OrderType.DINE_IN,
        status: OrderStatus.CREATED,
        paymentStatus: OrderPaymentStatus.UNPAID,
        tableSessionId: session.id,
        totalAmount,
        notes: dto.notes ?? null,
      });

      const savedOrder = await queryRunner.manager.save(order);
      savedOrderId = savedOrder.id;
      for (const item of orderItems) item.order = savedOrder;
      await queryRunner.manager.save(orderItems);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    const order = (await this.orderRepository.findOne({
      where: { id: savedOrderId },
      relations: ['items', 'items.product', 'table', 'tableSession'],
    })) as Order;

    this.kitchenGateway.emitOrderCreated(order);
    void this.tableSessionsService.bumpExpiresAt(session.id).catch(() => undefined);

    if (captureTiming === CaptureTiming.ON_PREMISE) {
      this.kitchenGateway.broadcastPendingConfirmation(order);
      return { order };
    }

    // PREPAID: delegate to the configured provider
    const provider = this.providerRegistry.get(config!.provider);
    const result = await provider.initiate(order, config!);

    if (result.kind === 'redirect') {
      await this.paymentRepository.save(
        this.paymentRepository.create({
          businessId: session.businessId,
          orderId: order.id,
          method: dto.paymentMethod,
          status: PaymentStatus.PENDING,
          amount: order.totalAmount,
          providerRef: result.providerRef,
          providerStatus: 'INITIATED',
        }),
      );
      return { order, redirectUrl: result.url };
    }

    if (result.kind === 'instant') {
      await this.paymentRepository.save(
        this.paymentRepository.create({
          businessId: session.businessId,
          orderId: order.id,
          method: dto.paymentMethod,
          status: PaymentStatus.CONFIRMED,
          amount: order.totalAmount,
          providerRef: result.providerRef,
          confirmedAt: new Date(),
        }),
      );
      order.paymentStatus = OrderPaymentStatus.PAID;
      await this.orderRepository.save(order);
      const afterConfirm = await this.transitionOrder(order, OrderStatus.CONFIRMED);
      return { order: afterConfirm };
    }

    // Provider returned 'manual' despite PREPAID config — fall back to ON_PREMISE gating
    this.kitchenGateway.broadcastPendingConfirmation(order);
    return { order };
  }

  async createFromStaff(
    businessId: string,
    dto: CreateStaffOrderDto,
    staffId?: string,
  ): Promise<Order> {
    let tableSessionId: string | null = null;
    let tableId: string | null = null;

    if (dto.type === OrderType.DINE_IN) {
      if (!dto.tableId) {
        throw new BadRequestException('tableId is required for DINE_IN orders');
      }
      const session = await this.tableSessionsService.findOrCreateForTable(businessId, dto.tableId);
      tableSessionId = session.id;
      tableId = dto.tableId;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let totalAmount = 0;
      const orderItems: OrderItem[] = [];

      for (const itemDto of dto.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: itemDto.productId, businessId },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${itemDto.productId} not found`);
        }

        const modifiers = itemDto.selectedModifiers ?? [];
        const modifierPrice = modifiers.reduce((sum, m) => sum + Number(m.priceAdjustment), 0);
        const unitPrice = Number(product.price) + modifierPrice;
        totalAmount += unitPrice * itemDto.quantity;

        const orderItem = queryRunner.manager.create(OrderItem, {
          productId: product.id,
          quantity: itemDto.quantity,
          unitPrice,
          notes: itemDto.notes,
          selectedModifiers: modifiers.map((m) =>
            queryRunner.manager.create(OrderItemModifier, {
              modifierId: m.modifierId,
              modifierName: m.name,
              priceAdjustment: m.priceAdjustment,
            }),
          ),
        });
        orderItems.push(orderItem);
      }

      const order = queryRunner.manager.create(Order, {
        businessId,
        type: dto.type,
        status: OrderStatus.CREATED,
        tableId,
        tableSessionId,
        totalAmount,
        customerName: dto.customerName ?? null,
        notes: dto.notes ?? null,
        waiterId: staffId ?? null,
      });

      const savedOrder = await queryRunner.manager.save(order);

      for (const item of orderItems) {
        item.order = savedOrder;
      }

      await queryRunner.manager.save(orderItems);
      await queryRunner.commitTransaction();

      let createdOrder = (await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: [
          'items',
          'items.product',
          'items.product.kitchenStation',
          'table',
          'tableSession',
        ],
      })) as Order;

      this.kitchenGateway.emitOrderCreated(createdOrder);
      createdOrder = await this.transitionOrder(createdOrder, OrderStatus.CONFIRMED);

      return createdOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Staff confirmation for ON_PREMISE orders: CREATED → CONFIRMED → IN_KITCHEN.
   * Called by POST /orders/:id/confirm (WAITER+).
   */
  async confirmOrder(businessId: string, orderId: string, actor: ActorInfo): Promise<Order> {
    const order = await this.findOne(businessId, orderId);
    if (order.status !== OrderStatus.CREATED) {
      throw new BadRequestException(
        `Only CREATED orders can be confirmed by staff (current: ${order.status})`,
      );
    }
    return this.transitionOrder(order, OrderStatus.CONFIRMED, actor);
  }

  /**
   * Staff payment recording: creates a CONFIRMED payment and returns the updated order.
   * Called by POST /orders/:id/payments (CASHIER / MANAGER / OWNER).
   */
  async recordStaffPayment(
    businessId: string,
    orderId: string,
    dto: { method: PaymentMethod; amount: number; tipAmount?: number },
    staffId: string | null,
  ): Promise<Order> {
    const order = await this.findOne(businessId, orderId);
    const business = await this.businessRepository.findOne({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    if (dto.tipAmount && !business.features?.includes(BusinessFeature.TIPS)) {
      throw new ForbiddenException('Tips are not enabled for this business');
    }

    await this.paymentRepository.save(
      this.paymentRepository.create({
        businessId,
        orderId: order.id,
        method: dto.method,
        status: PaymentStatus.CONFIRMED,
        amount: dto.amount,
        confirmedAt: new Date(),
        confirmedById: staffId,
      }),
    );

    if (dto.tipAmount) {
      order.tipAmount = Number(dto.tipAmount);
      await this.orderRepository.save(order);
    }

    return this.recomputeAndAdvance(order);
  }

  /**
   * Recomputes order.paymentStatus from SUM(CONFIRMED payments), saves it,
   * then advances the order: fires kitchen for PREPAID CREATED orders,
   * or closes for fully-delivered orders.
   */
  async recomputeAndAdvance(order: Order): Promise<Order> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .from(Payment, 'p')
      .where('p."orderId" = :orderId AND p.status = :status', {
        orderId: order.id,
        status: PaymentStatus.CONFIRMED,
      })
      .getRawOne<{ total: string }>();

    const paidTotal = Number(row?.total ?? 0);
    const required = Number(order.totalAmount) + Number(order.tipAmount ?? 0);

    if (paidTotal >= required) {
      order.paymentStatus = OrderPaymentStatus.PAID;
    } else if (paidTotal > 0) {
      order.paymentStatus = OrderPaymentStatus.PARTIALLY_PAID;
    }

    let saved = await this.orderRepository.save(order);

    if (saved.paymentStatus !== OrderPaymentStatus.PAID) return saved;

    // PREPAID: order was waiting on payment before kitchen could start.
    // transitionOrder now locks the row and re-validates against the committed status, so a
    // concurrent call advancing the same order (e.g. a duplicate webhook delivery racing the
    // reconcile poller) throws BadRequestException instead of double-transitioning and
    // double-emitting — that's expected here and treated as an idempotent no-op.
    if (saved.status === OrderStatus.CREATED) {
      const fullOrder = (await this.orderRepository.findOne({
        where: { id: saved.id },
        relations: [
          'items',
          'items.product',
          'items.product.kitchenStation',
          'table',
          'tableSession',
        ],
      })) as Order;
      try {
        saved = await this.transitionOrder(fullOrder, OrderStatus.CONFIRMED);
      } catch (err) {
        if (!(err instanceof BadRequestException)) throw err;
        saved = (await this.orderRepository.findOne({ where: { id: saved.id } })) as Order;
      }
    } else if (
      saved.status === OrderStatus.DELIVERED ||
      (saved.type === OrderType.TAKEAWAY && saved.status === OrderStatus.READY)
    ) {
      const latestPayment = await this.paymentRepository.findOne({
        where: { orderId: saved.id, status: PaymentStatus.CONFIRMED },
        order: { confirmedAt: 'DESC' },
      });
      try {
        saved = await this.transitionOrder(saved, OrderStatus.CLOSED, SYSTEM_ACTOR, (closed) =>
          this.kitchenGateway.emitOrderPaid(closed, latestPayment?.id ?? ''),
        );
      } catch (err) {
        if (!(err instanceof BadRequestException)) throw err;
        saved = (await this.orderRepository.findOne({ where: { id: saved.id } })) as Order;
      }
    }

    return saved;
  }

  async findAll(
    businessId: string,
    pagination: { page: number; limit: number },
  ): Promise<import('@common/types/paginated-response.type').PaginatedResponse<Order>> {
    const { page, limit } = pagination;
    const [data, total] = await this.orderRepository.findAndCount({
      where: { businessId },
      relations: ['items', 'items.product', 'items.product.kitchenStation', 'table'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(businessId: string, id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, businessId },
      relations: [
        'items',
        'items.product',
        'items.product.kitchenStation',
        'table',
        'waiter',
        'tableSession',
      ],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async updateStatus(
    businessId: string,
    id: string,
    dto: UpdateOrderStatusDto,
    actorRole?: StaffRole | null,
    actor?: ActorInfo,
  ): Promise<Order> {
    const order = await this.findOne(businessId, id);

    if (dto.status === OrderStatus.CANCELLED) {
      this.orderTransitionService.assertCancellationPermission(actorRole, order.status);
    }

    this.orderTransitionService.assertKitchenTransitionPermission(actorRole, dto.status);

    return this.transitionOrder(order, dto.status, actor);
  }

  async cancelBySession(orderId: string, sessionToken: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'items',
        'items.product',
        'items.product.kitchenStation',
        'table',
        'tableSession',
      ],
    });

    if (!order) throw new NotFoundException('Order not found');
    if (!order.tableSession || order.tableSession.sessionToken !== sessionToken) {
      throw new ForbiddenException('Session does not own this order');
    }
    if (order.status !== OrderStatus.CREATED) {
      throw new BadRequestException('Order can only be cancelled while pending confirmation');
    }

    return this.transitionOrder(order, OrderStatus.CANCELLED, { type: 'system', id: 'customer' });
  }

  async processCashPayment(
    businessId: string,
    orderId: string,
    dto: ProcessPaymentDto,
  ): Promise<Order> {
    return this.processStaffPayment(businessId, orderId, PaymentMethod.CASH, dto);
  }

  async processPosPayment(
    businessId: string,
    orderId: string,
    dto: ProcessPaymentDto,
  ): Promise<Order> {
    return this.processStaffPayment(businessId, orderId, PaymentMethod.POS, dto);
  }

  /**
   * POST /orders/:id/payment/confirm — cashier confirms the pending payment
   * that was auto-created when the order was served (READY → DELIVERED).
   * Transitions DELIVERED → CLOSED and emits 'order:paid'.
   */
  async confirmOrderPayment(
    businessId: string,
    orderId: string,
    staffId: string | null,
    dto: ConfirmOrderPaymentDto = {},
  ): Promise<Order> {
    const order = await this.findOne(businessId, orderId);
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        `Order must be DELIVERED to confirm payment (current: ${order.status})`,
      );
    }

    const payment = await this.paymentRepository.findOne({
      where: { orderId: order.id, businessId, status: PaymentStatus.PENDING },
    });
    if (!payment) throw new NotFoundException('No pending payment found for this order');

    if (dto.method) payment.method = dto.method;
    if (dto.tipAmount) {
      order.tipAmount = Number(dto.tipAmount);
      await this.orderRepository.save(order);
    }

    return this.closeWithPayment(order, payment, staffId);
  }

  /**
   * Marks an order's payment as failed (called from payment reconciliation / provider
   * webhook, never directly by staff — see ROLE_TRANSITIONS on OrderTransitionService).
   */
  async markPaymentFailed(order: Order, reason: string): Promise<Order> {
    order.paymentStatus = OrderPaymentStatus.FAILED;
    await this.orderRepository.save(order);

    const failed = await this.transitionOrder(order, OrderStatus.PAYMENT_FAILED);
    this.kitchenGateway.emitPaymentFailed(failed, reason);

    return failed;
  }

  /**
   * Staff-initiated refund of a already-closed (paid) order. There is no payment-provider
   * refund integration yet, so refundId is a caller-supplied external reference.
   */
  async refundOrder(businessId: string, orderId: string, dto: RefundOrderDto): Promise<Order> {
    const order = await this.findOne(businessId, orderId);
    if (order.status !== OrderStatus.CLOSED) {
      throw new BadRequestException(`Order must be CLOSED to refund (current: ${order.status})`);
    }

    order.paymentStatus = OrderPaymentStatus.REFUNDED;
    await this.orderRepository.save(order);

    const refunded = await this.transitionOrder(order, OrderStatus.REFUNDED);
    const refundId = dto.refundId ?? randomUUID();
    this.kitchenGateway.emitOrderRefunded(refunded, refundId);

    return refunded;
  }

  private async processStaffPayment(
    businessId: string,
    orderId: string,
    method: PaymentMethod,
    dto: ProcessPaymentDto,
  ): Promise<Order> {
    const order = await this.findOne(businessId, orderId);
    const business = await this.businessRepository.findOne({ where: { id: businessId } });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const expectedStatus =
      order.type === OrderType.DINE_IN ? OrderStatus.DELIVERED : OrderStatus.READY;
    if (order.status !== expectedStatus) {
      throw new BadRequestException(`Order must be ${expectedStatus} before payment`);
    }

    if (dto.tipAmount && !business.features?.includes(BusinessFeature.TIPS)) {
      throw new ForbiddenException('Tips are not enabled for this business');
    }

    // Payment method availability is not represented in BusinessFeature enum currently.
    // Previously the code checked BusinessFeature.CASH_PAYMENT / POS_PAYMENT which do not exist
    // on the enum. To avoid referencing missing enum members we skip those checks here.

    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        businessId,
        orderId: order.id,
        method,
        status: PaymentStatus.CONFIRMED,
        amount: Number(order.totalAmount) + Number(dto.tipAmount ?? 0),
        confirmedAt: new Date(),
        confirmedById: null, // Will be set by staff when staff authentication is fully integrated
      }),
    );

    order.tipAmount = Number(dto.tipAmount ?? 0);
    order.paymentStatus = OrderPaymentStatus.PAID;
    // Must persist before transitionOrder, which now re-fetches+locks its own copy of the
    // row rather than saving this in-memory object — an unsaved mutation here would be lost.
    await this.orderRepository.save(order);

    // order:paid must reach clients before any session-closed emitted by refreshLifecycle
    // as a side effect of this same transition, so it's fired from onDispatched rather than
    // after transitionOrder returns.
    return this.transitionOrder(order, OrderStatus.CLOSED, SYSTEM_ACTOR, (closed) =>
      this.kitchenGateway.emitOrderPaid(closed, payment.id),
    );
  }

  /**
   * Re-fetches and locks the order row before validating/applying the transition, so two
   * concurrent transitions on the same order (e.g. a waiter cancelling while kitchen advances
   * it) serialize instead of both reading stale in-memory state and both emitting a broadcast
   * that disagrees with whichever save actually won. The loser re-validates against the
   * *committed* status and throws a normal BadRequestException instead of silently emitting
   * an event for a state that was never persisted.
   *
   * onDispatched runs right after the lifecycle emit and before refreshLifecycle/session-closed,
   * so callers that need to emit a follow-up event (e.g. order:paid) can guarantee it reaches
   * clients before a session-closed event for the same action.
   */
  private async transitionOrder(
    order: Order,
    next: OrderStatus,
    actor: ActorInfo = SYSTEM_ACTOR,
    onDispatched?: (order: Order) => void,
  ): Promise<Order> {
    const transitionActor = this.resolveTransitionActor(actor);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let updatedOrder: Order;
    try {
      // Postgres cannot apply FOR UPDATE to rows coming from the nullable side of a LEFT
      // JOIN (table/waiter/tableSession are all optional), so the lock must be acquired
      // against the bare "orders" row first, then the full relation graph loaded separately
      // within the same locked transaction.
      const lockedId = await queryRunner.manager
        .createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write')
        .where('order.id = :id', { id: order.id })
        .getOne();
      if (!lockedId) throw new NotFoundException(`Order with ID ${order.id} not found`);

      const locked = await queryRunner.manager
        .createQueryBuilder(Order, 'order')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('product.kitchenStation', 'kitchenStation')
        .leftJoinAndSelect('order.table', 'table')
        .leftJoinAndSelect('order.waiter', 'waiter')
        .leftJoinAndSelect('order.tableSession', 'tableSession')
        .where('order.id = :id', { id: order.id })
        .getOne();
      if (!locked) throw new NotFoundException(`Order with ID ${order.id} not found`);

      // transition() validates and mutates against the row's current committed status,
      // not the caller's possibly-stale in-memory copy.
      this.orderTransitionService.transition(locked, next, transitionActor);
      updatedOrder = await queryRunner.manager.save(locked);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    this.dispatchOrderEvent(updatedOrder, next);
    onDispatched?.(updatedOrder);

    // A transition landing on an OPEN_ORDER_STATUSES status can never leave zero open orders
    // on the session (this order itself still counts as open) — skip the count query on the
    // hot path (CONFIRMED/IN_KITCHEN/READY/DELIVERED) and only check on exit transitions.
    if (updatedOrder.tableSessionId && !OPEN_ORDER_STATUSES.includes(next)) {
      await this.tableSessionsService.refreshLifecycle(updatedOrder.tableSessionId);
    }

    // When an order is served (DINE_IN), open a payment record for the cashier queue.
    if (next === OrderStatus.DELIVERED) {
      void this.openPaymentForCashier(updatedOrder).catch((err) =>
        console.error('Failed to open cashier payment', err),
      );
    }

    // When an order is closed, increment totalOrderCount on products in a single grouped UPDATE
    if (next === OrderStatus.CLOSED) {
      try {
        // Use a single raw SQL update to increment totalOrderCount grouped by productId.
        // This is a single statement and avoids fetching/updating each product individually.
        const sql = `
            UPDATE products p
            SET "totalOrderCount" = COALESCE(p."totalOrderCount",0) + COALESCE(sub.sum,0)
            FROM (
              SELECT "productId" AS product_id, SUM(quantity) AS sum
              FROM order_items
              WHERE "orderId" = $1
              GROUP BY "productId"
            ) sub
            WHERE p.id = sub.product_id AND p."businessId" = $2
          `;

        await this.dataSource.query(sql, [order.id, order.businessId]);
      } catch (err) {
        // Don't block order transition if the counter update fails; log if logging is available

        console.error('Failed to bump product totalOrderCount', err);
      }
    }

    return updatedOrder;
  }

  private async openPaymentForCashier(order: Order): Promise<void> {
    const [business, fullOrder] = await Promise.all([
      this.businessRepository.findOne({ where: { id: order.businessId } }),
      this.orderRepository.findOne({
        where: { id: order.id },
        relations: ['tableSession'],
      }),
    ]);
    if (!business || !fullOrder) return;

    const amount = Number(fullOrder.totalAmount);
    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        businessId: fullOrder.businessId,
        orderId: fullOrder.id,
        method: PaymentMethod.POS,
        status: PaymentStatus.PENDING,
        amount,
      }),
    );

    this.kitchenGateway.emitPaymentOpen(fullOrder, payment.id, amount);

    if (business.posAutoAcceptPayment) {
      await this.closeWithPayment(fullOrder, payment, null);
    }
  }

  private async closeWithPayment(
    order: Order,
    payment: Payment,
    staffId: string | null,
  ): Promise<Order> {
    payment.status = PaymentStatus.CONFIRMED;
    payment.confirmedAt = new Date();
    payment.confirmedById = staffId;
    await this.paymentRepository.save(payment);

    order.paymentStatus = OrderPaymentStatus.PAID;
    await this.orderRepository.save(order);

    // order:paid must reach clients before any session-closed emitted by refreshLifecycle
    // as a side effect of this same transition (see transitionOrder's onDispatched).
    return this.transitionOrder(order, OrderStatus.CLOSED, SYSTEM_ACTOR, (closed) =>
      this.kitchenGateway.emitOrderPaid(closed, payment.id),
    );
  }

  private resolveTransitionActor(actor: ActorInfo): TransitionActor {
    if (actor.type === 'system') return 'system';
    if (actor.type === 'owner') return StaffRole.MANAGER;
    return (actor.role as TransitionActor | undefined) ?? 'system';
  }

  private dispatchOrderEvent(order: Order, next: OrderStatus): void {
    switch (next) {
      case OrderStatus.CONFIRMED:
        this.kitchenGateway.emitOrderConfirmed(order);
        break;
      case OrderStatus.IN_KITCHEN:
        this.kitchenGateway.emitOrderPreparing(order);
        break;
      case OrderStatus.READY:
        this.kitchenGateway.emitOrderReady(order);
        break;
      case OrderStatus.DELIVERED:
        this.kitchenGateway.emitOrderServed(order);
        break;
      case OrderStatus.CANCELLED:
        this.kitchenGateway.emitOrderCancelled(order);
        break;
      // CLOSED / PAYMENT_FAILED / REFUNDED handled by payment flow (Part 3)
    }
  }
}
