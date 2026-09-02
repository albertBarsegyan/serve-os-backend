import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PinoLogger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Order } from '@modules/orders/entities/order.entity';
import { TableSession } from '@modules/table-sessions/table-session.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { Display } from '@modules/display/entities/display.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';
import { CustomerOrderStatus, toCustomerStatus } from '@modules/orders/customer-order-status';
import { hashDisplayToken } from '@modules/display/utils/display-token.util';
import {
  buildDisplayOrderPayload,
  DisplayOrderPayload,
} from '@modules/display/utils/display-order.util';
import type { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { ROLE_PERMISSION_MAP, StaffPermission } from '@common/enums/staff-permission.enum';
import { CLIENT_EVENTS, SERVER_EVENTS } from './kitchen-events.constants';

interface AuthResult {
  payload: AuthPayload;
  /** JWT `exp` claim (seconds since epoch) — used to force a re-auth once it passes. */
  exp: number;
}

export interface ActorInfo {
  type: 'owner' | 'staff' | 'system';
  id: string;
  role?: string;
}

export interface OrderEventPayload {
  orderId: string;
  businessId: string;
  tableId: string | null;
  sessionToken: string | null;
  status: OrderStatus;
  customerStatus: CustomerOrderStatus;
  playSound: boolean;
  at: string;
}

export interface CallWaiterPayload {
  businessId: string;
  tableId: string | null;
  sessionToken: string;
  tableNumber: number | null;
  at: string;
}

export interface PaymentFailedPayload extends OrderEventPayload {
  reason: string;
}

export interface OrderRefundedPayload extends OrderEventPayload {
  refundId: string;
}

// Kept for the join-session reconnect-sync path only.
export interface OrderStatusChangedPayload {
  orderId: string;
  status: string;
  customerStatus: CustomerOrderStatus;
  // DELIVERED and CLOSED both map to customerStatus 'served' — paymentStatus lets the
  // customer app tell "served, awaiting payment" and "paid, all done" apart on resync,
  // where live per-transition events (order:payment-open / order:paid) aren't available.
  paymentStatus: string;
  previousStatus: string | null;
  tableId: string | null;
  tableName: string | null;
  sessionToken: string | null;
  updatedAt: string;
  actor: ActorInfo;
  tipAmount: number;
}

/** business:<id> only — staff dashboards, not the kitchen display. */
export interface OrderTipUpdatedPayload {
  orderId: string;
  businessId: string;
  tipAmount: number;
  updatedAt: string;
}

export interface SessionClosedPayload {
  sessionId: string;
}

/** Emitted for session:opened — a new guest party seated (or a staff order opened one). */
export interface SessionOpenedPayload {
  sessionId: string;
  businessId: string;
  tableId: string;
  /** 'guest' for a QR scan, 'staff' when a staff-created order opened the session. */
  source: 'guest' | 'staff';
  at: string;
}

/** Emitted for session:joined / session:split — payload only carries enough to know "refetch
 * this business's sessions," not the full merge graph. */
export interface SessionLifecyclePayload {
  sessionId: string;
  businessId: string;
  tableId: string;
  at: string;
}

/** Emitted for order:waiter-acknowledged — clears the call raised by order:call-waiter. */
export interface WaiterAcknowledgedPayload {
  sessionId: string;
  businessId: string;
  tableId: string;
  at: string;
}

export interface DisplayOrderRemovedPayload {
  orderId: string;
}

export interface OrderPendingConfirmationPayload {
  orderId: string;
  tableId: string | null;
  sessionToken: string | null;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * A guest's open menu page has no way to learn an item just went out of stock mid-session
 * (TanStack Query's 5-min staleTime otherwise leaves it orderable in their browser for up to
 * that long) — this is a lightweight signal, not a full product payload, so the client just
 * refetches the public menu rather than trying to patch a single item in its cache.
 */
export interface MenuAvailabilityChangedPayload {
  businessId: string;
  productId: string;
  isAvailable: boolean;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class KitchenGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  /**
   * A socket's handshake cookie is captured once at connect time and never refreshed, so
   * without this a socket that joined a room while its access token was still valid would
   * keep receiving that tenant's live feed forever, even long after the token expires,
   * since nothing about the room membership is time-limited on its own. Keyed by socket id;
   * cleared on disconnect (handleDisconnect) so it never leaks.
   */
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  /**
   * call-waiter has no JWT/cookie auth (a guest's sessionToken is the only credential, same
   * as join-session) and, unlike every REST endpoint in this codebase, nothing at the gateway
   * level runs a ThrottlerGuard — so without this, a raw socket client that knows (or
   * brute-forces) an active sessionToken could spam-broadcast to the business room with no
   * server-side limit; the frontend's 5s button cooldown only constrains the shipped UI, not
   * a hostile client. Keyed by sessionToken (the guest's actual identity) rather than socket
   * id, so the cooldown survives a reconnect. Swept opportunistically so it never grows
   * unbounded over a long-running server.
   */
  private readonly callWaiterCooldowns = new Map<string, number>();
  private static readonly CALL_WAITER_COOLDOWN_MS = 5000;
  private static readonly CALL_WAITER_COOLDOWN_SWEEP_THRESHOLD = 500;

  constructor(
    private readonly logger: PinoLogger,
    private readonly jwtService: JwtService,
    @InjectRepository(TableSession)
    private readonly tableSessionRepository: Repository<TableSession>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(Display)
    private readonly displayRepository: Repository<Display>,
  ) {}

  handleConnection(client: Socket) {
    this.logger.info({ clientId: client.id }, 'Kitchen client connected');
  }

  handleDisconnect(client: Socket) {
    this.logger.info({ clientId: client.id }, 'Kitchen client disconnected');
    const timer = this.expiryTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(client.id);
    }
  }

  @SubscribeMessage(CLIENT_EVENTS.JOIN_KITCHEN)
  async handleJoinKitchen(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (!this.isValidRoomKey(body)) return { event: 'error', data: 'Invalid payload' };
    const businessId = body;

    const auth = await this.authenticate(client);
    if (
      !auth ||
      !(await this.canAccessBusiness(auth.payload, businessId)) ||
      !this.hasPermission(auth.payload, StaffPermission.KITCHEN_VIEW)
    ) {
      this.logger.warn({ clientId: client.id, businessId }, 'Rejected unauthorized join-kitchen');
      return { event: 'error', data: 'Unauthorized' };
    }

    await client.join(`kitchen:${businessId}`);
    this.scheduleExpiryDisconnect(client, auth.exp);
    this.logger.debug({ clientId: client.id, businessId }, 'Kitchen client joined room');
    return { event: 'joined', data: businessId };
  }

  @SubscribeMessage(CLIENT_EVENTS.JOIN_BUSINESS)
  async handleJoinBusiness(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (!this.isValidRoomKey(body)) return { event: 'error', data: 'Invalid payload' };
    const businessId = body;

    const auth = await this.authenticate(client);
    if (
      !auth ||
      !(await this.canAccessBusiness(auth.payload, businessId)) ||
      !this.hasPermission(auth.payload, StaffPermission.ORDER_VIEW)
    ) {
      this.logger.warn({ clientId: client.id, businessId }, 'Rejected unauthorized join-business');
      return { event: 'error', data: 'Unauthorized' };
    }

    await client.join(`business:${businessId}`);
    this.scheduleExpiryDisconnect(client, auth.exp);
    return { event: 'joined', data: businessId };
  }

  /**
   * Leaving is always safe to allow unconditionally (no auth check needed) — a socket can
   * only ever remove itself from a room it's already in. Without this, a socket that joins
   * kitchen/business for one tenant and later joins another (e.g. an owner switching their
   * active business) keeps receiving the first tenant's live order/payment feed indefinitely,
   * since it's never explicitly removed until the whole connection drops.
   */
  @SubscribeMessage(CLIENT_EVENTS.LEAVE_KITCHEN)
  async handleLeaveKitchen(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (!this.isValidRoomKey(body)) return;
    await client.leave(`kitchen:${body}`);
  }

  @SubscribeMessage(CLIENT_EVENTS.LEAVE_BUSINESS)
  async handleLeaveBusiness(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (!this.isValidRoomKey(body)) return;
    await client.leave(`business:${body}`);
  }

  @SubscribeMessage(CLIENT_EVENTS.LEAVE_SESSION)
  async handleLeaveSession(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (!this.isValidRoomKey(body)) return;
    await client.leave(`session:${body}`);
  }

  @SubscribeMessage(CLIENT_EVENTS.LEAVE_DISPLAY)
  async handleLeaveDisplay(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (!this.isValidRoomKey(body)) return;
    await client.leave(`display:${body}`);
  }

  /**
   * No auth beyond a well-formed businessId — the public menu itself is already served
   * unauthenticated (GET /menu/customer, @Public()), so a live feed of "an item's availability
   * changed" leaks nothing the guest couldn't already fetch directly.
   */
  @SubscribeMessage(CLIENT_EVENTS.JOIN_MENU)
  async handleJoinMenu(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (!this.isValidRoomKey(body)) return { event: 'error', data: 'Invalid payload' };
    await client.join(`menu:${body}`);
    return { event: 'joined', data: body };
  }

  @SubscribeMessage(CLIENT_EVENTS.LEAVE_MENU)
  async handleLeaveMenu(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (!this.isValidRoomKey(body)) return;
    await client.leave(`menu:${body}`);
  }

  /**
   * A display token is a long-lived capability credential for an unattended TV, not a
   * human login — same trust model as join-session's guest sessionToken. An
   * invalid/revoked token must not just get an error reply, it must be disconnected,
   * since there's no human at the keyboard to retry with a fresh one.
   */
  @SubscribeMessage(CLIENT_EVENTS.JOIN_DISPLAY)
  async handleJoinDisplay(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (!this.isValidRoomKey(body)) return { event: 'error', data: 'Invalid payload' };
    const token = body;

    const display = await this.displayRepository.findOne({
      where: { tokenHash: hashDisplayToken(token), revokedAt: IsNull() },
    });

    if (!display) {
      this.logger.warn({ clientId: client.id }, 'Rejected join-display for invalid/revoked token');
      client.disconnect(true);
      return { event: 'error', data: 'Unauthorized' };
    }

    await client.join(`display:${display.businessId}`);
    this.logger.debug(
      { clientId: client.id, businessId: display.businessId },
      'Display joined room',
    );
    return { event: 'joined', data: display.businessId };
  }

  /**
   * A session token is the guest's only credential — it must map to a currently
   * active table session, otherwise a stale/closed/guessed token could still be
   * used to listen in on a table's live order feed.
   */
  @SubscribeMessage(CLIENT_EVENTS.JOIN_SESSION)
  async handleJoinSession(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (!this.isValidRoomKey(body)) return { event: 'error', data: 'Invalid payload' };
    const sessionToken = body;

    const session = await this.tableSessionRepository.findOne({
      where: { sessionToken, isActive: true },
      relations: ['orders', 'orders.table'],
    });

    if (!session) {
      this.logger.warn({ clientId: client.id }, 'Rejected join-session for invalid/expired token');
      return { event: 'error', data: 'Unauthorized' };
    }

    await client.join(`session:${sessionToken}`);

    // Emit the current order status so the customer view syncs on connect/reconnect.
    // Uses order:status-changed (legacy) so the customer page can treat this as initial state
    // rather than a transition event. Picks the most recently updated order regardless of
    // status — including terminal ones (CLOSED/CANCELLED/REFUNDED/PAYMENT_FAILED) — so a
    // customer reloading right after payment, cancellation, or a refund still resyncs to the
    // correct screen instead of getting no payload at all. The frontend already guards on
    // orderId matching the order it's tracking, so this is safe even with multiple orders.
    const [activeOrder] = [...(session.orders ?? [])].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
    if (activeOrder) {
      const syncPayload: OrderStatusChangedPayload = {
        orderId: activeOrder.id,
        status: activeOrder.status,
        customerStatus: toCustomerStatus(activeOrder.status),
        paymentStatus: activeOrder.paymentStatus,
        previousStatus: null,
        tableId: activeOrder.tableId,
        tableName:
          activeOrder?.table?.number !== null && activeOrder?.table?.number !== undefined
            ? String(activeOrder?.table?.number)
            : null,
        sessionToken,
        updatedAt: activeOrder.updatedAt.toISOString(),
        actor: { type: 'system', id: 'system' },
        tipAmount: Number(activeOrder.tipAmount ?? 0),
      };
      client.emit(SERVER_EVENTS.ORDER_STATUS_CHANGED, syncPayload);
    }

    return { event: 'joined', data: sessionToken };
  }

  @SubscribeMessage(CLIENT_EVENTS.CALL_WAITER)
  async handleCallWaiter(@MessageBody() body: unknown): Promise<void> {
    if (!this.isValidCallWaiterBody(body)) return;
    const { sessionToken } = body;

    if (this.isCallWaiterOnCooldown(sessionToken)) {
      this.logger.debug({ sessionToken }, 'Call-waiter rate-limited');
      return;
    }

    const session = await this.tableSessionRepository.findOne({
      where: { sessionToken, isActive: true },
      relations: ['table'],
    });
    if (!session) return;

    // Persisted (not just broadcast) so a staff client that reconnects, or opens the tables
    // page after the call was raised, still sees it — a page refresh must not lose the call.
    session.waiterCallActive = true;
    session.waiterCallAt = new Date();
    await this.tableSessionRepository.save(session);

    const payload: CallWaiterPayload = {
      businessId: session.businessId,
      tableId: session.tableId,
      tableNumber: session.table?.number ?? null,
      sessionToken,
      at: new Date().toISOString(),
    };

    this.server.to(`business:${session.businessId}`).emit(SERVER_EVENTS.ORDER_CALL_WAITER, payload);
    this.logger.debug({ sessionToken }, 'Call-waiter broadcast');
  }

  /**
   * Records the attempt regardless of outcome (even an invalid/stale token consumes its
   * cooldown slot) so a brute-force loop of guessed tokens can't dodge the limit by varying
   * the token on every call — only a genuinely valid, distinct sessionToken buys a fresh slot.
   */
  private isCallWaiterOnCooldown(sessionToken: string): boolean {
    const now = Date.now();

    if (this.callWaiterCooldowns.size >= KitchenGateway.CALL_WAITER_COOLDOWN_SWEEP_THRESHOLD) {
      for (const [token, calledAt] of this.callWaiterCooldowns) {
        if (now - calledAt >= KitchenGateway.CALL_WAITER_COOLDOWN_MS) {
          this.callWaiterCooldowns.delete(token);
        }
      }
    }

    const lastCalledAt = this.callWaiterCooldowns.get(sessionToken);
    if (lastCalledAt !== undefined && now - lastCalledAt < KitchenGateway.CALL_WAITER_COOLDOWN_MS) {
      return true;
    }

    this.callWaiterCooldowns.set(sessionToken, now);
    return false;
  }

  /** CREATED → business room (waiter gets an audible new-order alert). */
  emitOrderCreated(order: Order): void {
    const payload = this.buildPayload(order, true);
    this.server.to(`business:${order.businessId}`).emit(SERVER_EVENTS.ORDER_CREATED, payload);
    this.logger.debug({ orderId: order.id }, 'order:created emitted');
  }

  /** CONFIRMED → session (customer) + kitchen (KDS gets audible alert). */
  emitOrderConfirmed(order: Order): void {
    const payload = this.buildPayload(order, true);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server
        .to(`session:${token}`)
        .emit(SERVER_EVENTS.ORDER_CONFIRMED, { ...payload, playSound: false });
    }
    this.server.to(`kitchen:${order.businessId}`).emit(SERVER_EVENTS.ORDER_CONFIRMED, payload);
    this.logger.debug({ orderId: order.id }, 'order:confirmed emitted');
    this.emitDisplayUpdate(order);
  }

  // ── Typed emit helpers ───────────────────────────────────────────────────────
  // Each emits to exactly the rooms listed in the order-flow spec.

  /**
   * IN_KITCHEN → session (customer alert) + business (waiter progress) + kitchen (a second
   * KDS screen/tab needs this live too, not just the screen that made the transition).
   */
  emitOrderPreparing(order: Order): void {
    const payload = this.buildPayload(order, true);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit(SERVER_EVENTS.ORDER_PREPARING, payload);
    }
    this.server.to(`business:${order.businessId}`).emit(SERVER_EVENTS.ORDER_PREPARING, payload);
    this.server.to(`kitchen:${order.businessId}`).emit(SERVER_EVENTS.ORDER_PREPARING, payload);
    this.logger.debug({ orderId: order.id }, 'order:preparing emitted');
    this.emitDisplayUpdate(order);
  }

  /** READY → session (customer alert) + business (waiter notified) + kitchen (other KDS screens). */
  emitOrderReady(order: Order): void {
    const payload = this.buildPayload(order, true);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit(SERVER_EVENTS.ORDER_READY, payload);
    }
    this.server.to(`business:${order.businessId}`).emit(SERVER_EVENTS.ORDER_READY, payload);
    this.server.to(`kitchen:${order.businessId}`).emit(SERVER_EVENTS.ORDER_READY, payload);
    this.logger.debug({ orderId: order.id }, 'order:ready emitted');
    this.emitDisplayUpdate(order);
  }

  /**
   * DELIVERED → session (customer sees "served") + business (cashier payment queue opens)
   * + kitchen (order leaves the KDS board on every screen watching it, not just the actor's).
   */
  emitOrderServed(order: Order): void {
    const payload = this.buildPayload(order, true);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit(SERVER_EVENTS.ORDER_SERVED, payload);
    }
    this.server.to(`business:${order.businessId}`).emit(SERVER_EVENTS.ORDER_SERVED, payload);
    this.server.to(`kitchen:${order.businessId}`).emit(SERVER_EVENTS.ORDER_SERVED, payload);
    this.logger.debug({ orderId: order.id }, 'order:served emitted');
    this.emitDisplayRemoved(order);
  }

  /** CANCELLED → session + business + kitchen (everyone is notified). */
  emitOrderCancelled(order: Order): void {
    const payload = this.buildPayload(order, false);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit(SERVER_EVENTS.ORDER_CANCELLED, payload);
    }
    this.server.to(`business:${order.businessId}`).emit(SERVER_EVENTS.ORDER_CANCELLED, payload);
    this.server.to(`kitchen:${order.businessId}`).emit(SERVER_EVENTS.ORDER_CANCELLED, payload);
    this.logger.debug({ orderId: order.id }, 'order:cancelled emitted');
    this.emitDisplayRemoved(order);
  }

  /** DELIVERED → session (customer sees payment due) + business (cashier payment queue opens). */
  emitPaymentOpen(order: Order, paymentId: string, amount: number): void {
    const payload = {
      orderId: order.id,
      businessId: order.businessId,
      tableId: order.tableId,
      amount,
      paymentId,
      at: new Date().toISOString(),
    };
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit(SERVER_EVENTS.ORDER_PAYMENT_OPEN, payload);
    }
    this.server.to(`business:${order.businessId}`).emit(SERVER_EVENTS.ORDER_PAYMENT_OPEN, payload);
    this.logger.debug({ orderId: order.id, paymentId }, 'order:payment-open emitted');
  }

  /** CLOSED via payment → session + business: order fully settled. */
  emitOrderPaid(order: Order, paymentId: string): void {
    const payload = {
      orderId: order.id,
      businessId: order.businessId,
      paymentId,
      customerStatus: toCustomerStatus(order.status),
      at: new Date().toISOString(),
    };
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit(SERVER_EVENTS.ORDER_PAID, payload);
    }
    this.server.to(`business:${order.businessId}`).emit(SERVER_EVENTS.ORDER_PAID, payload);
    this.logger.debug({ orderId: order.id, paymentId }, 'order:paid emitted');
  }

  /**
   * A tip was written on an order — business room only (staff dashboards/bill views), not
   * kitchen. The customer's own device already has the value from its mutation response;
   * this is for staff visibility and for other devices watching the same business.
   */
  emitTipUpdated(order: Order): void {
    const payload: OrderTipUpdatedPayload = {
      orderId: order.id,
      businessId: order.businessId,
      tipAmount: Number(order.tipAmount ?? 0),
      updatedAt: order.updatedAt.toISOString(),
    };
    this.server.to(`business:${order.businessId}`).emit(SERVER_EVENTS.ORDER_TIP_UPDATED, payload);
    this.logger.debug({ orderId: order.id }, 'order:tip-updated emitted');
  }

  /** PAYMENT_FAILED → session (customer alert) + business (cashier needs to retry/cancel). */
  emitPaymentFailed(order: Order, reason: string): void {
    const payload: PaymentFailedPayload = { ...this.buildPayload(order, true), reason };
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit(SERVER_EVENTS.ORDER_PAYMENT_FAILED, payload);
    }
    this.server
      .to(`business:${order.businessId}`)
      .emit(SERVER_EVENTS.ORDER_PAYMENT_FAILED, payload);
    this.logger.debug({ orderId: order.id, reason }, 'order:payment-failed emitted');
    this.emitDisplayRemoved(order);
  }

  /** REFUNDED → session + business + kitchen (a paid-then-refunded order reopened). */
  emitOrderRefunded(order: Order, refundId: string): void {
    const payload: OrderRefundedPayload = { ...this.buildPayload(order, false), refundId };
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit(SERVER_EVENTS.ORDER_REFUNDED, payload);
    }
    this.server.to(`business:${order.businessId}`).emit(SERVER_EVENTS.ORDER_REFUNDED, payload);
    this.server.to(`kitchen:${order.businessId}`).emit(SERVER_EVENTS.ORDER_REFUNDED, payload);
    this.logger.debug({ orderId: order.id, refundId }, 'order:refunded emitted');
    this.emitDisplayRemoved(order);
  }

  /**
   * A table session ends (all orders settled/paid, or a staff-initiated close) → session room
   * (so the guest's browser can clear its stored session token/credentials) + business room
   * (so every staff dashboard learns the session is gone and stops offering to close/act on
   * it — this used to be session-room-only, which is why a stale "Close session" button could
   * fire against a session the backend had already torn down).
   */
  emitSessionClosed(sessionToken: string, sessionId: string, businessId: string): void {
    const payload: SessionClosedPayload = { sessionId };
    this.server.to(`session:${sessionToken}`).emit(SERVER_EVENTS.SESSION_CLOSED, payload);
    this.server.to(`business:${businessId}`).emit(SERVER_EVENTS.SESSION_CLOSED, payload);
    this.logger.debug({ sessionId, sessionToken, businessId }, 'session-closed emitted');
  }

  /** A new session opened (guest QR scan, or a staff order opening one) → business room. */
  emitSessionOpened(
    session: {
      id: string;
      businessId: string;
      tableId: string;
    },
    source: 'guest' | 'staff',
  ): void {
    const payload: SessionOpenedPayload = {
      sessionId: session.id,
      businessId: session.businessId,
      tableId: session.tableId,
      source,
      at: new Date().toISOString(),
    };
    this.server.to(`business:${session.businessId}`).emit(SERVER_EVENTS.SESSION_OPENED, payload);
    this.logger.debug({ sessionId: session.id, source }, 'session:opened emitted');
  }

  /** Two sessions were billed together (or a join was reversed) → business room. */
  emitSessionJoined(session: { id: string; businessId: string; tableId: string }): void {
    const payload: SessionLifecyclePayload = {
      sessionId: session.id,
      businessId: session.businessId,
      tableId: session.tableId,
      at: new Date().toISOString(),
    };
    this.server.to(`business:${session.businessId}`).emit(SERVER_EVENTS.SESSION_JOINED, payload);
    this.logger.debug({ sessionId: session.id }, 'session:joined emitted');
  }

  emitSessionSplit(session: { id: string; businessId: string; tableId: string }): void {
    const payload: SessionLifecyclePayload = {
      sessionId: session.id,
      businessId: session.businessId,
      tableId: session.tableId,
      at: new Date().toISOString(),
    };
    this.server.to(`business:${session.businessId}`).emit(SERVER_EVENTS.SESSION_SPLIT, payload);
    this.logger.debug({ sessionId: session.id }, 'session:split emitted');
  }

  /** Staff acknowledged a raised waiter call → business room, clears it for every device. */
  emitWaiterAcknowledged(session: { id: string; businessId: string; tableId: string }): void {
    const payload: WaiterAcknowledgedPayload = {
      sessionId: session.id,
      businessId: session.businessId,
      tableId: session.tableId,
      at: new Date().toISOString(),
    };
    this.server
      .to(`business:${session.businessId}`)
      .emit(SERVER_EVENTS.ORDER_WAITER_ACKNOWLEDGED, payload);
    this.logger.debug({ sessionId: session.id }, 'order:waiter-acknowledged emitted');
  }

  broadcastPendingConfirmation(order: Order): void {
    const payload: OrderPendingConfirmationPayload = {
      orderId: order.id,
      tableId: order.tableId,
      sessionToken: order.tableSession?.sessionToken ?? null,
      items: (order.items ?? []).map((item) => ({
        productId: item.productId,
        name: item.product?.name ?? '',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
    };

    this.server
      .to(`business:${order.businessId}`)
      .emit(SERVER_EVENTS.ORDER_PENDING_CONFIRMATION, payload);
    this.logger.debug({ orderId: order.id }, 'Order pending confirmation broadcast');
  }

  /** A product's isAvailable flag changed → business (staff dashboards) + menu (open guest menu pages). */
  emitMenuAvailabilityChanged(businessId: string, productId: string, isAvailable: boolean): void {
    const payload: MenuAvailabilityChangedPayload = { businessId, productId, isAvailable };
    this.server.to(`business:${businessId}`).emit(SERVER_EVENTS.MENU_AVAILABILITY_CHANGED, payload);
    this.server.to(`menu:${businessId}`).emit(SERVER_EVENTS.MENU_AVAILABILITY_CHANGED, payload);
    this.logger.debug({ businessId, productId, isAvailable }, 'menu:availability-changed emitted');
  }

  /**
   * join-kitchen / join-business grant a live feed of a business's orders and payments,
   * so the caller must be authenticated (owner/staff access_token cookie forwarded via
   * withCredentials) and must actually belong to the businessId it asks to join —
   * otherwise any socket could snoop on another tenant's POS stream by guessing its id.
   */
  private async authenticate(client: Socket): Promise<AuthResult | null> {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) return null;

    const token = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('access_token='))
      ?.slice('access_token='.length);

    if (!token) return null;

    try {
      // verifyAsync returns the standard JWT claims (exp/iat) alongside AuthPayload's fields.
      const decoded = await this.jwtService.verifyAsync<AuthPayload & { exp: number }>(
        decodeURIComponent(token),
      );
      return { payload: decoded, exp: decoded.exp };
    } catch {
      return null;
    }
  }

  /**
   * The socket's handshake cookie is fixed at connect time and never re-read, so once this
   * exact token expires it can never pass authenticate() again on this connection. Forcing a
   * disconnect at that point (rather than leaving the room quietly subscribed forever) makes
   * the client reconnect — which re-sends whatever cookie the browser holds *now* (hopefully
   * refreshed via the normal HTTP refresh-token flow by then) and its existing 'connect'
   * handler already rejoins rooms and resyncs state, so this is a low-disruption recovery path.
   */
  private scheduleExpiryDisconnect(client: Socket, exp: number): void {
    const existing = this.expiryTimers.get(client.id);
    if (existing) clearTimeout(existing);

    const msUntilExpiry = exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) return;

    const timer = setTimeout(() => {
      this.logger.info(
        { clientId: client.id },
        'Access token expired — disconnecting socket to force re-auth on reconnect',
      );
      client.disconnect(true);
    }, msUntilExpiry);

    this.expiryTimers.set(client.id, timer);
  }

  // ── Legacy broadcast helpers (kept for backward compat / join-session sync) ─

  private async canAccessBusiness(payload: AuthPayload, businessId: string): Promise<boolean> {
    if (payload.type === 'owner') {
      const business = await this.businessRepository.findOne({
        where: { id: businessId, ownerId: payload.userId },
      });
      return !!business;
    }

    if (payload.type === 'staff') {
      if (payload.businessId !== businessId) return false;
      // Unlike the JWT claim alone, this catches a staff account deactivated or removed
      // after the token was issued — @DeleteDateColumn already excludes soft-deleted rows.
      const staff = await this.staffRepository.findOne({
        where: { id: payload.staffId, businessId, isActive: true },
      });
      return !!staff;
    }

    return false;
  }

  /**
   * Owners always pass — StaffPermission only governs staff accounts, matching the frontend
   * route guards (e.g. routes/_admin/kitchen.tsx only gates on `user.permissions` for
   * `user?.type === 'staff'`). Mirrors that same permission requirement here so a staff JWT
   * can't join a room the UI would never have let that role open in the first place.
   */
  private hasPermission(payload: AuthPayload, permission: StaffPermission): boolean {
    if (payload.type === 'owner') return true;
    return ROLE_PERMISSION_MAP[payload.role]?.includes(permission) ?? false;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Every join- and leave- handler's @MessageBody() is a raw socket.io payload with no
   * class-validator DTO layer (unlike every REST DTO in this codebase) — the declared
   * `string` param types were previously just a compile-time hint with nothing enforcing them
   * at runtime. A businessId/sessionToken/token is always used as a room-name suffix or a raw
   * WHERE-clause value, so this guards against non-string, empty, or unreasonably long input
   * before it reaches template-literal room names or a repository query.
   */
  private isValidRoomKey(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 512;
  }

  private isValidCallWaiterBody(value: unknown): value is { sessionToken: string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      this.isValidRoomKey((value as Record<string, unknown>).sessionToken)
    );
  }

  private buildPayload(order: Order, playSound: boolean): OrderEventPayload {
    return {
      orderId: order.id,
      businessId: order.businessId,
      tableId: order.tableId,
      sessionToken: order.tableSession?.sessionToken ?? null,
      status: order.status,
      customerStatus: toCustomerStatus(order.status),
      playSound,
      at: new Date().toISOString(),
    };
  }

  /** Order entered a displayable status (CONFIRMED/IN_KITCHEN/READY) → display room, sanitized. */
  private emitDisplayUpdate(order: Order): void {
    const payload: DisplayOrderPayload = buildDisplayOrderPayload(order);
    this.server
      .to(`display:${order.businessId}`)
      .emit(SERVER_EVENTS.DISPLAY_ORDER_UPDATED, payload);
    this.logger.debug({ orderId: order.id }, 'display:order-updated emitted');
  }

  /** Order left the displayable set (served/cancelled/payment-failed/refunded) → drop it. */
  private emitDisplayRemoved(order: Order): void {
    const payload: DisplayOrderRemovedPayload = { orderId: order.id };
    this.server
      .to(`display:${order.businessId}`)
      .emit(SERVER_EVENTS.DISPLAY_ORDER_REMOVED, payload);
    this.logger.debug({ orderId: order.id }, 'display:order-removed emitted');
  }
}
