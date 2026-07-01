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
import { OrderStatus } from '@modules/orders/entities/order-status.enum';
import { CustomerOrderStatus, toCustomerStatus } from '@modules/orders/customer-order-status';
import type { AuthPayload } from '@modules/auth/types/auth-payload.type';

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

// Kept for the join-session reconnect-sync path only.
export interface OrderStatusChangedPayload {
  orderId: string;
  status: string;
  previousStatus: string | null;
  tableId: string | null;
  tableName: string | null;
  sessionToken: string | null;
  updatedAt: string;
  actor: ActorInfo;
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

const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.CLOSED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
  OrderStatus.PAYMENT_FAILED,
];

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

  constructor(
    private readonly logger: PinoLogger,
    private readonly jwtService: JwtService,
    @InjectRepository(TableSession)
    private readonly tableSessionRepository: Repository<TableSession>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  handleConnection(client: Socket) {
    this.logger.info({ clientId: client.id }, 'Kitchen client connected');
  }

  handleDisconnect(client: Socket) {
    this.logger.info({ clientId: client.id }, 'Kitchen client disconnected');
  }

  /**
   * join-kitchen / join-business grant a live feed of a business's orders and payments,
   * so the caller must be authenticated (owner/staff access_token cookie forwarded via
   * withCredentials) and must actually belong to the businessId it asks to join —
   * otherwise any socket could snoop on another tenant's POS stream by guessing its id.
   */
  private async authenticate(client: Socket): Promise<AuthPayload | null> {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) return null;

    const token = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('access_token='))
      ?.slice('access_token='.length);

    if (!token) return null;

    try {
      return await this.jwtService.verifyAsync<AuthPayload>(decodeURIComponent(token));
    } catch {
      return null;
    }
  }

  private async canAccessBusiness(payload: AuthPayload, businessId: string): Promise<boolean> {
    if (payload.type === 'owner') {
      const business = await this.businessRepository.findOne({
        where: { id: businessId, ownerId: payload.userId },
      });
      return !!business;
    }

    if (payload.type === 'staff') {
      return payload.businessId === businessId;
    }

    return false;
  }

  @SubscribeMessage('join-kitchen')
  async handleJoinKitchen(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    const payload = await this.authenticate(client);
    if (!payload || !(await this.canAccessBusiness(payload, businessId))) {
      this.logger.warn({ clientId: client.id, businessId }, 'Rejected unauthorized join-kitchen');
      return { event: 'error', data: 'Unauthorized' };
    }

    await client.join(`kitchen:${businessId}`);
    this.logger.debug({ clientId: client.id, businessId }, 'Kitchen client joined room');
    return { event: 'joined', data: businessId };
  }

  @SubscribeMessage('join-business')
  async handleJoinBusiness(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    const payload = await this.authenticate(client);
    if (!payload || !(await this.canAccessBusiness(payload, businessId))) {
      this.logger.warn({ clientId: client.id, businessId }, 'Rejected unauthorized join-business');
      return { event: 'error', data: 'Unauthorized' };
    }

    await client.join(`business:${businessId}`);
    return { event: 'joined', data: businessId };
  }

  @SubscribeMessage('join-session')
  async handleJoinSession(@ConnectedSocket() client: Socket, @MessageBody() sessionToken: string) {
    await client.join(`session:${sessionToken}`);

    // Emit the current active order status so the customer view syncs on connect/reconnect.
    // Uses order:status-changed (legacy) so the customer page can treat this as initial state
    // rather than a transition event.
    const session = await this.tableSessionRepository.findOne({
      where: { sessionToken },
      relations: ['orders', 'orders.table'],
    });
    const activeOrder = session?.orders?.find((o) => !TERMINAL_STATUSES.includes(o.status));
    if (activeOrder) {
      const syncPayload: OrderStatusChangedPayload = {
        orderId: activeOrder.id,
        status: activeOrder.status,
        previousStatus: null,
        tableId: activeOrder.tableId,
        tableName: activeOrder?.table?.number !== null ? String(activeOrder?.table?.number) : null,
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
      where: { sessionToken: body.sessionToken },
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

  // ── Typed emit helpers ───────────────────────────────────────────────────────
  // Each emits to exactly the rooms listed in the order-flow spec.

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
  }

  /** IN_KITCHEN → session (customer alert) + business (waiter progress). */
  emitOrderPreparing(order: Order): void {
    const payload = this.buildPayload(order, true);
    const token = order.tableSession?.sessionToken;
    if (token) {
      this.server.to(`session:${token}`).emit('order:preparing', payload);
    }
    this.server.to(`business:${order.businessId}`).emit('order:preparing', payload);
    this.logger.debug({ orderId: order.id }, 'order:preparing emitted');
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
  }

  /** DELIVERED → business room only (cashier payment queue opens in Part 3). */
  emitOrderServed(order: Order): void {
    const payload = this.buildPayload(order, true);
    this.server.to(`business:${order.businessId}`).emit('order:served', payload);
    this.logger.debug({ orderId: order.id }, 'order:served emitted');
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
  }

  /** DELIVERED → business room: cashier payment queue opens. */
  emitPaymentOpen(order: Order, paymentId: string, amount: number): void {
    this.server.to(`business:${order.businessId}`).emit('order:payment-open', {
      orderId: order.id,
      businessId: order.businessId,
      tableId: order.tableId,
      amount,
      paymentId,
      at: new Date().toISOString(),
    });
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

  // ── Legacy broadcast helpers (kept for backward compat / join-session sync) ─

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

  broadcastOrderUpdate(order: Order, previousStatus: OrderStatus | null, actor: ActorInfo): void {
    const payload: OrderStatusChangedPayload = {
      orderId: order.id,
      status: order.status,
      previousStatus,
      tableId: order.tableId,
      tableName: order.table?.number !== null ? String(order?.table?.number) : null,
      sessionToken: order.tableSession?.sessionToken ?? null,
      updatedAt: new Date().toISOString(),
      actor,
    };

    this.server.to(`kitchen:${order.businessId}`).emit('order:status-changed', payload);
    this.server.to(`business:${order.businessId}`).emit('order:status-changed', payload);
    if (order.tableSession?.sessionToken) {
      this.server
        .to(`session:${order.tableSession.sessionToken}`)
        .emit('order:status-changed', payload);
    }

    this.logger.debug(
      { orderId: order.id, status: order.status, previousStatus },
      'Order status broadcast',
    );
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
}
