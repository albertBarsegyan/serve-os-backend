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
import { Order } from '@modules/orders/entities/order.entity';
import { TableSession } from '@modules/table-sessions/table-session.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';

export interface ActorInfo {
  type: 'owner' | 'staff' | 'system';
  id: string;
  role?: string;
}

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
    origin: '*',
  },
})
export class KitchenGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly logger: PinoLogger,
    @InjectRepository(TableSession)
    private readonly tableSessionRepository: Repository<TableSession>,
  ) {}

  handleConnection(client: Socket) {
    this.logger.info({ clientId: client.id }, 'Kitchen client connected');
  }

  handleDisconnect(client: Socket) {
    this.logger.info({ clientId: client.id }, 'Kitchen client disconnected');
  }

  @SubscribeMessage('join-kitchen')
  async handleJoinKitchen(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    await client.join(`kitchen:${businessId}`);
    this.logger.debug({ clientId: client.id, businessId }, 'Kitchen client joined room');
    return { event: 'joined', data: businessId };
  }

  @SubscribeMessage('join-business')
  async handleJoinBusiness(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    await client.join(`business:${businessId}`);
    return { event: 'joined', data: businessId };
  }

  @SubscribeMessage('join-session')
  async handleJoinSession(@ConnectedSocket() client: Socket, @MessageBody() sessionToken: string) {
    await client.join(`session:${sessionToken}`);

    // Emit the current active order status so the customer view syncs on connect/reconnect
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
}
