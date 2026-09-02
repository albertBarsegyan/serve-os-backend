import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, In, QueryFailedError, QueryRunner, Repository } from 'typeorm';
import { TableSession } from './table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { KitchenGateway } from '@modules/kitchen/kitchen.gateway';
import { Payment } from '@modules/payments/entities/payment.entity';
import { PaymentMethod, PaymentStatus, TipSource } from '@common/enums/payment.enum';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { recomputeOrderTipAmount } from '@modules/payments/utils/recompute-tip-amount.util';
import {
  GUEST_TIP_ABSOLUTE_MAX_MINOR_UNITS,
  GUEST_TIP_SUBTOTAL_MULTIPLIER_CAP,
} from '@common/constants/tip.constants';
import { CreateTipDto } from './dto/create-tip.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { syncTableReservedState } from './table-reserved-state.util';

// DINE_IN-only (every table-session order is DINE_IN — see Order's DB check constraint).
// A guest may tip once the order has been served; earlier states haven't reached payment
// collection yet, and later/terminal states are settled or void.
const TIPPABLE_ORDER_STATUSES = [OrderStatus.DELIVERED];

// Exported so callers (e.g. OrdersService) can tell upfront whether a transition could
// possibly leave zero open orders on a session, without duplicating this list.
export const OPEN_ORDER_STATUSES = [
  OrderStatus.CREATED,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_KITCHEN,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
];

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function newExpiresAt(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class TableSessionsService {
  constructor(
    @InjectRepository(TableSession)
    private readonly tableSessionRepository: Repository<TableSession>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly kitchenGateway: KitchenGateway,
  ) {}

  // existingSessionToken is this device's own session cookie/localStorage token, if it has
  // one — passing it lets a reload or re-tap of the same QR link on the same device
  // continue its own session instead of minting a new one. Without a match (a genuinely
  // different device scanning, or no token at all) this always creates a fresh session —
  // a table can carry several concurrent sessions now (see TableSession.mergedIntoSessionId),
  // so scanning no longer joins whatever session happens to already be active for the table.
  async scan(qrCode: string, existingSessionToken?: string) {
    const table = await this.tableRepository.findOne({ where: { qrCode, isActive: true } });
    if (!table) {
      throw new NotFoundException('Table not found or inactive');
    }

    const business = await this.businessRepository.findOne({
      where: { id: table.businessId, isActive: true },
      relations: ['paymentMethods'],
    });
    if (!business) {
      throw new NotFoundException('Business not found or inactive');
    }

    const session = await this.findOrCreateForTable(
      table.businessId,
      table.id,
      existingSessionToken,
    );

    return {
      sessionToken: session.sessionToken,
      tableSessionId: session.id,
      businessId: session.businessId,
      tableId: session.tableId,
      tableName: `Table ${table.number}`,
      businessName: business.name,
      businessLogoUrl: business.logoUrl ?? null,
      paymentMethods: (business.paymentMethods ?? [])
        .filter((m) => m.isActive && !m.deletedAt)
        .map((m) => ({ method: m.method, isActive: m.isActive })),
    };
  }

  async resumeByToken(token: string) {
    const session = await this.tableSessionRepository.findOne({
      where: { sessionToken: token, isActive: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found or inactive');
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new NotFoundException('Session expired');
    }

    const [table, business] = await Promise.all([
      this.tableRepository.findOne({ where: { id: session.tableId } }),
      this.businessRepository.findOne({
        where: { id: session.businessId },
        relations: ['paymentMethods'],
      }),
    ]);

    if (!table || !business) {
      throw new NotFoundException('Session data incomplete');
    }

    return {
      sessionToken: session.sessionToken,
      tableSessionId: session.id,
      businessId: session.businessId,
      tableId: session.tableId,
      tableName: `Table ${table.number}`,
      businessName: business.name,
      businessLogoUrl: business.logoUrl ?? null,
      paymentMethods: (business.paymentMethods ?? [])
        .filter((m) => m.isActive && !m.deletedAt)
        .map((m) => ({ method: m.method, isActive: m.isActive })),
    };
  }

  async bumpExpiresAt(sessionId: string): Promise<void> {
    await this.tableSessionRepository.update(
      { id: sessionId, isActive: true },
      { expiresAt: newExpiresAt() },
    );
  }

  // Only rejoins a session this exact device already owns (matched by its own token) —
  // any other request always gets a fresh session. See scan()'s comment for why.
  async findOrCreateForTable(
    businessId: string,
    tableId: string,
    existingSessionToken?: string,
  ): Promise<TableSession> {
    if (existingSessionToken) {
      const existing = await this.tableSessionRepository.findOne({
        where: { businessId, tableId, sessionToken: existingSessionToken, isActive: true },
      });
      if (existing) {
        return existing;
      }
    }

    return this.createSessionForTable(businessId, tableId, 'guest');
  }

  /** Validates a specific session belongs to this table/business and is active — used when
   * staff pick a specific existing session (of possibly several) to attach a new order to. */
  async getActiveSessionForTable(
    businessId: string,
    tableId: string,
    sessionId: string,
  ): Promise<TableSession | null> {
    return this.tableSessionRepository.findOne({
      where: { id: sessionId, businessId, tableId, isActive: true },
    });
  }

  /** Staff-order fallback when no session was explicitly picked: reuse the table's one
   * active session if there's exactly one (continuing whatever's already happening there),
   * otherwise start a fresh one. Ambiguous only when the table already carries 2+ concurrent
   * sessions — callers should pass sessionId explicitly in that case. */
  async getOrCreateDefaultSessionForTable(
    businessId: string,
    tableId: string,
  ): Promise<TableSession> {
    const active = await this.tableSessionRepository.find({
      where: { businessId, tableId, isActive: true },
      order: { openedAt: 'DESC' },
    });
    if (active.length === 1) {
      return active[0];
    }
    if (active.length > 1) {
      throw new BadRequestException(
        'This table has multiple active sessions — specify which one to add the order to',
      );
    }
    return this.createSessionForTable(businessId, tableId, 'staff');
  }

  private async createSessionForTable(
    businessId: string,
    tableId: string,
    source: 'guest' | 'staff',
  ): Promise<TableSession> {
    const session = await this.tableSessionRepository.save(
      this.tableSessionRepository.create({
        businessId,
        tableId,
        sessionToken: generateSessionToken(),
        isActive: true,
        closedAt: null,
        expiresAt: newExpiresAt(),
      }),
    );
    await syncTableReservedState(this.dataSource.manager, tableId);
    this.kitchenGateway.emitSessionOpened(session, source);
    return session;
  }

  /** True for a Postgres unique_violation (23505), regardless of which constraint. */
  private isUniqueConstraintViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError: unknown = error.driverError;
    const code =
      driverError && typeof driverError === 'object' && 'code' in driverError
        ? driverError.code
        : undefined;
    return code === '23505';
  }

  async getActiveByToken(sessionToken: string): Promise<TableSession> {
    const session = await this.tableSessionRepository.findOne({
      where: { sessionToken, isActive: true },
    });

    if (!session) {
      throw new ForbiddenException('Invalid or expired sessionToken');
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new ForbiddenException('Session has expired');
    }

    return session;
  }

  async getBillBySession(sessionId: string, businessId: string) {
    const session = await this.tableSessionRepository.findOne({
      where: { id: sessionId, businessId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const orders = await this.orderRepository.find({
      where: { tableSessionId: session.id },
      relations: ['items', 'items.product', 'items.product.kitchenStation'],
      order: { createdAt: 'ASC' },
    });

    const grouped = orders.reduce<Record<string, Order[]>>((acc, order) => {
      const token = order.tableSession?.sessionToken ?? 'unknown';
      if (!acc[token]) {
        acc[token] = [];
      }
      acc[token].push(order);
      return acc;
    }, {});

    const groups = Object.entries(grouped).map(([sessionToken, groupedOrders]) => ({
      sessionToken,
      orders: groupedOrders,
      subtotal: groupedOrders.reduce((sum, current) => sum + Number(current.totalAmount), 0),
      tipTotal: groupedOrders.reduce((sum, current) => sum + Number(current.tipAmount ?? 0), 0),
    }));

    return {
      sessionId: session.id,
      tableId: session.tableId,
      businessId: session.businessId,
      groups,
    };
  }

  /**
   * Idempotent: closing an already-closed session is a race (another staff device, or
   * refreshLifecycle auto-closing it moments earlier via a payment), not a user error — it
   * returns the already-closed session rather than throwing, so a stale client's "Close
   * session" click never surfaces an error toast for a session that's already gone.
   */
  async closeSession(sessionId: string, payload?: AuthPayload): Promise<TableSession> {
    // authorization
    if (payload?.type === 'staff') {
      const allowed = [StaffRole.WAITER, StaffRole.MANAGER];
      if (!allowed.includes(payload.role)) {
        throw new ForbiddenException('Only WAITER or MANAGER can close sessions');
      }
    }

    const session = await this.tableSessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (!session.isActive) {
      return session;
    }

    const blockingCount = await this.orderRepository.count({
      where: {
        tableSessionId: session.id,
        status: In(OPEN_ORDER_STATUSES),
      },
    });
    if (blockingCount > 0) {
      throw new BadRequestException('Cannot close session with active or unpaid orders');
    }

    const mergedChildrenCount = await this.tableSessionRepository.count({
      where: { mergedIntoSessionId: session.id, isActive: true },
    });
    if (mergedChildrenCount > 0) {
      throw new BadRequestException(
        'Other sessions are still joined into this one — close or split them first',
      );
    }

    session.isActive = false;
    session.closedAt = new Date();
    await this.tableSessionRepository.save(session);
    await syncTableReservedState(this.dataSource.manager, session.tableId);
    this.kitchenGateway.emitSessionClosed(session.sessionToken, session.id, session.businessId);
    return session;
  }

  /** Auto-closes the session once its last order settles (e.g. fully paid) — this is
   * what tells a customer's browser to clear its stored session credentials after
   * the "all done" state, without staff having to close the session manually.
   *
   * Locks the session row before counting open orders — OrdersService.createGuestOrder
   * and .createFromQr take the same lock (via lockAndReactivateSession) before their own
   * insert, so this count can never run in the gap between a new order's insert starting
   * and committing. Without the shared lock, this could see zero open orders (the new
   * order not yet committed) and close the session out from under a guest whose order is
   * still in flight. */
  async refreshLifecycle(sessionId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let closed: TableSession | null = null;
    try {
      const session = await queryRunner.manager
        .createQueryBuilder(TableSession, 'session')
        .setLock('pessimistic_write')
        .where('session.id = :id', { id: sessionId })
        .getOne();
      if (!session?.isActive) {
        await queryRunner.commitTransaction();
        return;
      }

      const activeCount = await queryRunner.manager.count(Order, {
        where: OPEN_ORDER_STATUSES.map((status) => ({
          tableSessionId: sessionId,
          status,
        })),
      });

      if (activeCount === 0) {
        session.isActive = false;
        session.closedAt = new Date();
        await queryRunner.manager.save(session);
        await syncTableReservedState(queryRunner.manager, session.tableId);
        closed = session;
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    if (closed) {
      this.kitchenGateway.emitSessionClosed(closed.sessionToken, closed.id, closed.businessId);
    }
  }

  /** Picks the session's most-recently-updated order — mirrors the same selection
   * KitchenGateway.handleJoinSession uses to resync a reconnecting customer, so a
   * session-scoped write always targets the same order a reconnecting client would see. */
  async getMostRecentOrderForSession(sessionId: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { tableSessionId: sessionId },
      order: { updatedAt: 'DESC' },
    });
  }

  /** Same selection as getMostRecentOrderForSession, with the item/table relations a guest
   * client needs to rebuild its order-tracking receipt — used only by the recent-order
   * recovery endpoint, so the lean version above stays cheap for the tip-guard hot path. */
  async getRecentOrderDetailForSession(sessionId: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { tableSessionId: sessionId },
      order: { updatedAt: 'DESC' },
      relations: ['items', 'items.product', 'table'],
    });
  }

  /** Every currently-active session across the business — a table can carry several at
   * once, so admin Tables view groups these (and the orders it already fetches separately)
   * by tableId client-side, the same way it already groups orders and payments. */
  async getActiveSessionsForBusiness(businessId: string): Promise<TableSession[]> {
    return this.tableSessionRepository.find({
      where: { businessId, isActive: true },
      order: { openedAt: 'ASC' },
    });
  }

  private assertStaffCanManageSessions(payload?: AuthPayload): void {
    if (payload?.type === 'staff') {
      const allowed = [StaffRole.WAITER, StaffRole.MANAGER];
      if (!allowed.includes(payload.role)) {
        throw new ForbiddenException('Only WAITER or MANAGER can manage sessions');
      }
    }
  }

  /**
   * Staff "join": marks sourceSessionId as billed together with targetSessionId (or
   * whichever session targetSessionId is itself already joined into — merges always
   * resolve to a single root so a join can never form a chain). Orders never move —
   * each order's tableSessionId still points at whichever session actually placed it,
   * so nothing about who ordered what is ever lost; mergedIntoSessionId is purely a
   * billing-group label the admin UI reads to show a combined bill.
   */
  async joinSessions(
    businessId: string,
    targetSessionId: string,
    dto: JoinSessionDto,
    payload?: AuthPayload,
  ): Promise<TableSession> {
    this.assertStaffCanManageSessions(payload);

    if (targetSessionId === dto.sourceSessionId) {
      throw new BadRequestException('Cannot join a session into itself');
    }

    const [target, source] = await Promise.all([
      this.tableSessionRepository.findOne({
        where: { id: targetSessionId, businessId, isActive: true },
      }),
      this.tableSessionRepository.findOne({
        where: { id: dto.sourceSessionId, businessId, isActive: true },
      }),
    ]);
    if (!target) throw new NotFoundException('Target session not found');
    if (!source) throw new NotFoundException('Source session not found');
    if (target.tableId !== source.tableId) {
      throw new BadRequestException('Sessions must belong to the same table to be joined');
    }

    const root = target.mergedIntoSessionId
      ? ((await this.tableSessionRepository.findOne({
          where: { id: target.mergedIntoSessionId },
        })) ?? target)
      : target;

    // root.id === source.id catches joining a session into its own root (a circular
    // target); source.mergedIntoSessionId === root.id catches the more common case of
    // re-joining a pair that's already merged together.
    if (root.id === source.id || source.mergedIntoSessionId === root.id) {
      throw new BadRequestException('These sessions are already joined');
    }

    const sourceHasChildren = await this.tableSessionRepository.count({
      where: { mergedIntoSessionId: source.id, isActive: true },
    });
    if (sourceHasChildren > 0) {
      throw new BadRequestException(
        'This session already has other sessions joined into it — join those into the target individually',
      );
    }

    source.mergedIntoSessionId = root.id;
    await this.tableSessionRepository.save(source);
    this.kitchenGateway.emitSessionJoined(root);
    return root;
  }

  /** Staff "split": detaches a session from whatever billing group it was joined into —
   * it goes back to standing (and being paid) on its own. */
  async splitSession(
    businessId: string,
    sessionId: string,
    payload?: AuthPayload,
  ): Promise<TableSession> {
    this.assertStaffCanManageSessions(payload);

    const session = await this.tableSessionRepository.findOne({
      where: { id: sessionId, businessId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (!session.mergedIntoSessionId) {
      throw new BadRequestException('This session is not joined with another');
    }

    session.mergedIntoSessionId = null;
    await this.tableSessionRepository.save(session);
    this.kitchenGateway.emitSessionSplit(session);
    return session;
  }

  /** Staff acknowledges a raised waiter call — clears it for every device watching the
   * business room, not just the one that pressed acknowledge. */
  async acknowledgeWaiterCall(
    businessId: string,
    sessionId: string,
    payload?: AuthPayload,
  ): Promise<TableSession> {
    this.assertStaffCanManageSessions(payload);

    const session = await this.tableSessionRepository.findOne({
      where: { id: sessionId, businessId },
    });
    if (!session) throw new NotFoundException('Session not found');

    if (session.waiterCallActive) {
      session.waiterCallActive = false;
      session.waiterCallAt = null;
      await this.tableSessionRepository.save(session);
      this.kitchenGateway.emitWaiterAcknowledged(session);
    }

    return session;
  }

  /**
   * POST /sessions/:sessionToken/tip — guest self-service tipping. TableSessionGuard has
   * already resolved `session` and the candidate `order`; everything that decides whether
   * the write is actually allowed is re-checked here against a freshly locked row, so a
   * stale guard-time read can never authorize a write the transaction itself wouldn't.
   */
  async createTip(
    session: TableSession,
    order: Order,
    dto: CreateTipDto,
  ): Promise<{ orderId: string; tipAmount: number; paymentId: string }> {
    if ((dto.amount === undefined) === (dto.percentage === undefined)) {
      throw new BadRequestException('Provide exactly one of amount or percentage');
    }

    const business = await this.businessRepository.findOne({ where: { id: session.businessId } });
    if (!business) throw new NotFoundException('Business not found');
    if (!business.features?.includes(BusinessFeature.TIPS)) {
      throw new ForbiddenException('Tips are not enabled for this business');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let result: {
      orderId: string;
      tipAmount: number;
      paymentId: string;
      emitOrder: Order | null;
    };
    try {
      result = await this.writeTip(queryRunner, session, order.id, business.id, dto);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    if (result.emitOrder) {
      this.kitchenGateway.emitTipUpdated(result.emitOrder);
    }

    return { orderId: result.orderId, tipAmount: result.tipAmount, paymentId: result.paymentId };
  }

  private async writeTip(
    queryRunner: QueryRunner,
    session: TableSession,
    orderId: string,
    businessId: string,
    dto: CreateTipDto,
  ): Promise<{ orderId: string; tipAmount: number; paymentId: string; emitOrder: Order | null }> {
    // Lock the bare row first — FOR UPDATE can't apply through a LEFT JOIN to a nullable
    // relation, matching OrdersService.transitionOrder's locking pattern. No relations are
    // needed here, so a single locked read is enough.
    const locked = await queryRunner.manager
      .createQueryBuilder(Order, 'order')
      .setLock('pessimistic_write')
      .where('order.id = :id', { id: orderId })
      .getOne();
    if (!locked) throw new NotFoundException('Order not found');

    if (locked.tableSessionId !== session.id) {
      throw new ForbiddenException('Session does not own this order');
    }
    if (locked.businessId !== businessId) {
      throw new ForbiddenException('Order does not belong to this business');
    }

    const existing = await queryRunner.manager.findOne(Payment, {
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (existing.orderId !== locked.id) {
        throw new ConflictException('idempotencyKey was already used for a different order');
      }
      // Replay: the write already happened — return the original result, don't repeat it.
      return {
        orderId: locked.id,
        tipAmount: Number(locked.tipAmount),
        paymentId: existing.id,
        emitOrder: null,
      };
    }

    if (!TIPPABLE_ORDER_STATUSES.includes(locked.status)) {
      throw new ConflictException(
        `Order is not eligible for a tip right now (status: ${locked.status})`,
      );
    }

    const subtotalMinor = Math.round(Number(locked.totalAmount) * 100);
    const tipMinor =
      dto.amount !== undefined
        ? dto.amount
        : Math.round((subtotalMinor * (dto.percentage ?? 0)) / 100);

    const effectiveMaxMinor = Math.min(
      GUEST_TIP_ABSOLUTE_MAX_MINOR_UNITS,
      subtotalMinor * GUEST_TIP_SUBTOTAL_MULTIPLIER_CAP,
    );
    if (tipMinor > effectiveMaxMinor) {
      throw new BadRequestException({
        error: 'TIP_CAP_EXCEEDED',
        message: `Tip cannot exceed ${(effectiveMaxMinor / 100).toFixed(2)} for this order`,
      });
    }

    const tipMajor = tipMinor / 100;

    let savedPayment: Payment;
    try {
      savedPayment = await queryRunner.manager.save(
        queryRunner.manager.create(Payment, {
          businessId,
          orderId: locked.id,
          method: PaymentMethod.ONLINE,
          status: PaymentStatus.CONFIRMED,
          amount: tipMajor,
          tipAmount: tipMajor,
          confirmedAt: new Date(),
          confirmedById: null,
          idempotencyKey: dto.idempotencyKey,
          tipSource: TipSource.GUEST,
          tipSourceSessionId: session.id,
        }),
      );
    } catch (err) {
      if (this.isUniqueConstraintViolation(err)) {
        // Lost a race for this idempotencyKey to a concurrent request on a different order
        // row (same-order races already serialize on the pessimistic lock above and are
        // caught by the existing-payment check) — treat it exactly like a replay.
        const winner = await queryRunner.manager.findOne(Payment, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (winner) {
          return {
            orderId: locked.id,
            tipAmount: Number(locked.tipAmount),
            paymentId: winner.id,
            emitOrder: null,
          };
        }
      }
      throw err;
    }

    locked.tipAmount = await recomputeOrderTipAmount(queryRunner.manager, locked.id);
    const savedOrder = await queryRunner.manager.save(locked);

    return {
      orderId: savedOrder.id,
      tipAmount: Number(savedOrder.tipAmount),
      paymentId: savedPayment.id,
      emitOrder: savedOrder,
    };
  }
}
