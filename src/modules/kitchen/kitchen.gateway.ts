import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PinoLogger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '@modules/orders/entities/order.entity';
import { TableSession } from '@modules/table-sessions/table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';

const OPEN_ORDER_STATUSES = [
  OrderStatus.CREATED,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_KITCHEN,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
];

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
  constructor(
    private readonly logger: PinoLogger,
    @InjectRepository(TableSession)
    private readonly tableSessionRepository: Repository<TableSession>,
  ) {}

  @WebSocketServer()
  server: Server;

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
        tableName: activeOrder.table?.number != null ? String(activeOrder.table.number) : null,
        sessionToken,
        updatedAt: activeOrder.updatedAt.toISOString(),
        actor: { type: 'system', id: 'system' },
      };
      client.emit('order:status-changed', syncPayload);
    }

    return { event: 'joined', data: sessionToken };
  }

  broadcastOrderUpdate(order: Order, previousStatus: OrderStatus | null, actor: ActorInfo): void {
    const payload: OrderStatusChangedPayload = {
      orderId: order.id,
      status: order.status,
      previousStatus,
      tableId: order.tableId,
      tableName: order.table?.number != null ? String(order.table.number) : null,
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
