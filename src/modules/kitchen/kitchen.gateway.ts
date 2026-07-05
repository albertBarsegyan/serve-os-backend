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
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Order } from '@modules/orders/entities/order.entity';
import { TableSession } from '@modules/table-sessions/table-session.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { Display } from '@modules/display/entities/display.entity';
import { IsNull } from 'typeorm';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';
import { CustomerOrderStatus, toCustomerStatus } from '@modules/orders/customer-order-status';
import { hashDisplayToken } from '@modules/display/utils/display-token.util';
import {
  buildDisplayOrderPayload,
  DisplayOrderPayload,
} from '@modules/display/utils/display-order.util';
import type { AuthPayload } from '@modules/auth/types/auth-payload.type';

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
}

export interface SessionClosedPayload {
  sessionId: string;
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

  @SubscribeMessage('join-kitchen')
  async handleJoinKitchen(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    const auth = await this.authenticate(client);
    if (!auth || !(await this.canAccessBusiness(auth.payload, businessId))) {
      this.logger.warn({ clientId: client.id, businessId }, 'Rejected unauthorized join-kitchen');
      return { event: 'error', data: 'Unauthorized' };
    }

    await client.join(`kitchen:${businessId}`);
    this.scheduleExpiryDisconnect(client, auth.exp);
    this.logger.debug({ clientId: client.id, businessId }, 'Kitchen client joined room');
    return { event: 'joined', data: businessId };
  }

  @SubscribeMessage('join-business')
  async handleJoinBusiness(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    const auth = await this.authenticate(client);
    if (!auth || !(await this.canAccessBusiness(auth.payload, businessId))) {
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
  @SubscribeMessage('leave-kitchen')
  async handleLeaveKitchen(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    await client.leave(`kitchen:${businessId}`);
  }

  @SubscribeMessage('leave-business')
  async handleLeaveBusiness(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    await client.leave(`business:${businessId}`);
  }

  @SubscribeMessage('leave-session')
  async handleLeaveSession(@ConnectedSocket() client: Socket, @MessageBody() sessionToken: string) {
    await client.leave(`session:${sessionToken}`);
  }

  @SubscribeMessage('leave-display')
  async handleLeaveDisplay(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    await client.leave(`display:${businessId}`);
  }

  /**
   * A display token is a long-lived capability credential for an unattended TV, not a
   * human login — same trust model as join-session's guest sessionToken. An
   * invalid/revoked token must not just get an error reply, it must be disconnected,
   * since there's no human at the keyboard to retry with a fresh one.
   */
  @SubscribeMessage('join-display')
  async handleJoinDisplay(@ConnectedSocket() client: Socket, @MessageBody() token: string) {
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
  @SubscribeMessage('join-session')
  async handleJoinSession(@ConnectedSocket() client: Socket, @MessageBody() sessionToken: string) {
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
      };
      client.emit('order:status-changed', syncPayload);
    }

    return { event: 'joined', data: sessionToken };
  }

  @SubscribeMessage('call-waiter')
  async handleCallWaiter(@MessageBody() body: { sessionToken: string }): Promise<void> {
    const session = await this.tableSessionRepository.findOne({
      where: { sessionToken: body.sessionToken, isActive: true },
    });
    if (!session) return;

    const payload: CallWaiterPayload = {
      businessId: session.businessId,
      tableId: session.tableId,
      sessionToken: body.sessionToken,
      at: new Date().toISOString(),
    };

    this.server.to(`business:${session.businessId}`).emit('order:call-waiter', payload);
    this.logger.debug({ sessionToken: body.sessionToken }, 'Call-waiter broadcast');
  }

  /** CREATED → business room (waiter gets an audible new-order alert). */
  emitOrderCreated(order: Order): void {
    const payload = this.buildPayload(order, true);
    this.server.to(`business:${order.businessId}`).emit('order:created', payload);
    this.logger.debug({ orderId: order.id }, 'order:created emitted');
  }

  /** CONFIRMED → session (customer) + kitchen (KDS gets audible alert). */
  emitOrderConfirmed(order: Order): void {
    const payload = this.buildPayload(order, true);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit('order:confirmed', { ...payload, playSound: false });
    }
    this.server.to(`kitchen:${order.businessId}`).emit('order:confirmed', payload);
    this.logger.debug({ orderId: order.id }, 'order:confirmed emitted');
    this.emitDisplayUpdate(order);
  }

  // ── Typed emit helpers ───────────────────────────────────────────────────────
  // Each emits to exactly the rooms listed in the order-flow spec.

  /** IN_KITCHEN → session (customer alert) + business (waiter progress). */
  emitOrderPreparing(order: Order): void {
    const payload = this.buildPayload(order, true);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit('order:preparing', payload);
    }
    this.server.to(`business:${order.businessId}`).emit('order:preparing', payload);
    this.logger.debug({ orderId: order.id }, 'order:preparing emitted');
    this.emitDisplayUpdate(order);
  }

  /** READY → session (customer alert) + business (waiter notified). */
  emitOrderReady(order: Order): void {
    const payload = this.buildPayload(order, true);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit('order:ready', payload);
    }
    this.server.to(`business:${order.businessId}`).emit('order:ready', payload);
    this.logger.debug({ orderId: order.id }, 'order:ready emitted');
    this.emitDisplayUpdate(order);
  }

  /** DELIVERED → session (customer sees "served") + business (cashier payment queue opens). */
  emitOrderServed(order: Order): void {
    const payload = this.buildPayload(order, true);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit('order:served', payload);
    }
    this.server.to(`business:${order.businessId}`).emit('order:served', payload);
    this.logger.debug({ orderId: order.id }, 'order:served emitted');
    this.emitDisplayRemoved(order);
  }

  /** CANCELLED → session + business + kitchen (everyone is notified). */
  emitOrderCancelled(order: Order): void {
    const payload = this.buildPayload(order, false);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit('order:cancelled', payload);
    }
    this.server.to(`business:${order.businessId}`).emit('order:cancelled', payload);
    this.server.to(`kitchen:${order.businessId}`).emit('order:cancelled', payload);
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
      this.server.to(`session:${token}`).emit('order:payment-open', payload);
    }
    this.server.to(`business:${order.businessId}`).emit('order:payment-open', payload);
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
      this.server.to(`session:${token}`).emit('order:paid', payload);
    }
    this.server.to(`business:${order.businessId}`).emit('order:paid', payload);
    this.logger.debug({ orderId: order.id, paymentId }, 'order:paid emitted');
  }

  /** PAYMENT_FAILED → session (customer alert) + business (cashier needs to retry/cancel). */
  emitPaymentFailed(order: Order, reason: string): void {
    const payload: PaymentFailedPayload = { ...this.buildPayload(order, true), reason };
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit('order:payment-failed', payload);
    }
    this.server.to(`business:${order.businessId}`).emit('order:payment-failed', payload);
    this.logger.debug({ orderId: order.id, reason }, 'order:payment-failed emitted');
    this.emitDisplayRemoved(order);
  }

  /** REFUNDED → session + business + kitchen (a paid-then-refunded order reopened). */
  emitOrderRefunded(order: Order, refundId: string): void {
    const payload: OrderRefundedPayload = { ...this.buildPayload(order, false), refundId };
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit('order:refunded', payload);
    }
    this.server.to(`business:${order.businessId}`).emit('order:refunded', payload);
    this.server.to(`kitchen:${order.businessId}`).emit('order:refunded', payload);
    this.logger.debug({ orderId: order.id, refundId }, 'order:refunded emitted');
    this.emitDisplayRemoved(order);
  }

  /**
   * A table session ends (all orders settled/paid, or a staff-initiated close) → session
   * room only, so the guest's browser can clear its stored session token/credentials and
   * stop treating itself as seated at the table.
   */
  emitSessionClosed(sessionToken: string, sessionId: string): void {
    const payload: SessionClosedPayload = { sessionId };
    this.server.to(`session:${sessionToken}`).emit('session-closed', payload);
    this.logger.debug({ sessionId, sessionToken }, 'session-closed emitted');
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

    this.server.to(`business:${order.businessId}`).emit('order-pending-confirmation', payload);
    this.logger.debug({ orderId: order.id }, 'Order pending confirmation broadcast');
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

  // ── Private helpers ──────────────────────────────────────────────────────────

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
    this.server.to(`display:${order.businessId}`).emit('display:order-updated', payload);
    this.logger.debug({ orderId: order.id }, 'display:order-updated emitted');
  }

  /** Order left the displayable set (served/cancelled/payment-failed/refunded) → drop it. */
  private emitDisplayRemoved(order: Order): void {
    const payload: DisplayOrderRemovedPayload = { orderId: order.id };
    this.server.to(`display:${order.businessId}`).emit('display:order-removed', payload);
    this.logger.debug({ orderId: order.id }, 'display:order-removed emitted');
  }
}
