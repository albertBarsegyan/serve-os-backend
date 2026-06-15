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
import { Repository } from 'typeorm';
import { Order } from '@modules/orders/entities/order.entity';
import { TableSession } from '@modules/table-sessions/table-session.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';

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

    // Immediately emit the current active order status so the customer view syncs on reconnect
    const session = await this.tableSessionRepository.findOne({
      where: { sessionToken },
      relations: ['orders'],
    });
    const activeOrder = session?.orders?.find((o) => !TERMINAL_STATUSES.includes(o.status));
    if (activeOrder) {
      client.emit('order.status', { orderId: activeOrder.id, status: activeOrder.status });
    }

    return { event: 'joined', data: sessionToken };
  }

  emitOrderCreated(order: Order) {
    const payload = { orderId: order.id, tableId: order.tableId, items: order.items ?? [] };
    this.server.to(`business:${order.businessId}`).emit('order.created', payload);
    this.server.to(`kitchen:${order.businessId}`).emit('order.created', payload);
  }

  emitOrderConfirmed(order: Order) {
    const payload = { orderId: order.id, tableId: order.tableId };
    if (order.tableSession?.sessionToken) {
      this.server.to(`session:${order.tableSession.sessionToken}`).emit('order.confirmed', payload);
    }
    this.server.to(`business:${order.businessId}`).emit('order.confirmed', payload);
  }

  emitOrderInKitchen(order: Order) {
    const payload = { orderId: order.id };
    this.server.to(`kitchen:${order.businessId}`).emit('order.in_kitchen', payload);
    if (order.tableSession?.sessionToken) {
      this.server
        .to(`session:${order.tableSession.sessionToken}`)
        .emit('order.in_kitchen', payload);
    }
  }

  emitOrderReady(order: Order) {
    const payload = { orderId: order.id, tableId: order.tableId };
    this.server.to(`business:${order.businessId}`).emit('order.ready', payload);
    if (order.tableSession?.sessionToken) {
      this.server.to(`session:${order.tableSession.sessionToken}`).emit('order.ready', payload);
    }
  }

  emitOrderDelivered(order: Order) {
    const payload = { orderId: order.id };
    this.server.to(`business:${order.businessId}`).emit('order.delivered', payload);
    if (order.tableSession?.sessionToken) {
      this.server.to(`session:${order.tableSession.sessionToken}`).emit('order.delivered', payload);
    }
  }

  emitOrderClosed(order: Order) {
    const payload = { orderId: order.id, total: order.totalAmount, tipAmount: order.tipAmount };
    this.server.to(`business:${order.businessId}`).emit('order.closed', payload);
    if (order.tableSession?.sessionToken) {
      this.server.to(`session:${order.tableSession.sessionToken}`).emit('order.closed', payload);
    }
  }

  emitOrderCancelled(order: Order) {
    const payload = { orderId: order.id, reason: 'cancelled' };
    this.server.to(`business:${order.businessId}`).emit('order.cancelled', payload);
    this.server.to(`kitchen:${order.businessId}`).emit('order.cancelled', payload);
    if (order.tableSession?.sessionToken) {
      this.server.to(`session:${order.tableSession.sessionToken}`).emit('order.cancelled', payload);
    }
  }

  emitOrderPaymentFailed(order: Order) {
    const payload = { orderId: order.id };
    this.server.to(`business:${order.businessId}`).emit('order.payment_failed', payload);
    if (order.tableSession?.sessionToken) {
      this.server
        .to(`session:${order.tableSession.sessionToken}`)
        .emit('order.payment_failed', payload);
    }
  }

  emitOrderRefunded(order: Order) {
    const payload = { orderId: order.id };
    this.server.to(`business:${order.businessId}`).emit('order.refunded', payload);
    if (order.tableSession?.sessionToken) {
      this.server.to(`session:${order.tableSession.sessionToken}`).emit('order.refunded', payload);
    }
  }
}
