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
export class KitchenGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
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
    await client.join(`kitchen-${businessId}`);
    this.logger.debug(
      { clientId: client.id, businessId },
      'Kitchen client joined room',
    );
    return { event: 'joined', data: businessId };
  }

  emitNewOrder(order: Order) {
    this.logger.info(
      {
        orderId: order.id,
        businessId: order.businessId,
        status: order.status,
      },
      'Emitting new order to kitchen room',
    );
    this.server.to(`kitchen-${order.businessId}`).emit('new-order', order);
  }

  emitOrderStatusUpdate(order: Order) {
    this.logger.info(
      {
        orderId: order.id,
        businessId: order.businessId,
        status: order.status,
      },
      'Emitting order status update to kitchen room',
    );
    this.server
      .to(`kitchen-${order.businessId}`)
      .emit('order-status-update', order);
  }
}
