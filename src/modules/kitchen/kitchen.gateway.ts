import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PinoLogger } from 'nestjs-pino';
import { Order } from '@modules/orders/entities/order.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class KitchenGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly logger: PinoLogger) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.info({ clientId: client.id }, 'Kitchen client connected');
  }

  handleDisconnect(client: Socket) {
    this.logger.info({ clientId: client.id }, 'Kitchen client disconnected');
  }

  @SubscribeMessage('join-kitchen')
  async handleJoinKitchen(client: Socket, @MessageBody() businessId: string) {
    await client.join(`kitchen:${businessId}`);
    this.logger.debug({ clientId: client.id, businessId }, 'Kitchen client joined room');
    return { event: 'joined', data: businessId };
  }

  @SubscribeMessage('join-business')
  async handleJoinBusiness(client: Socket, @MessageBody() businessId: string) {
    await client.join(`business:${businessId}`);
    return { event: 'joined', data: businessId };
  }

  @SubscribeMessage('join-session')
  async handleJoinSession(client: Socket, @MessageBody() sessionToken: string) {
    await client.join(`session:${sessionToken}`);
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
    this.server.to(`kitchen:${order.businessId}`).emit('order.in_kitchen', { orderId: order.id });
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
