import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { UpdateOrderStatusDto } from './dto/orders.dto';
import { Product } from '@modules/menu/entities/product.entity';
import { KitchenGateway } from '@modules/kitchen/kitchen.gateway';
import { Table } from '@modules/tables/entities/table.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { TableSessionsService } from '@modules/table-sessions/table-sessions.service';
import { CreateOrderFromQrDto } from './dto/create-order-from-qr.dto';
import { OrderItemModifier } from '@modules/modifiers/entities/order-item-modifier.entity';
import { OrderStatus } from './entities/order-status.enum';
import { OrderType } from './entities/order-type.enum';
import { Business } from '@modules/business/entities/business.entity';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { OrderTransitionService } from './order-transition.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { Payment } from '@modules/payments/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '@common/enums/payment.enum';
import { StaffRole } from '@common/enums/staff-role.enum';

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

      let createdOrder = (await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['items', 'items.product', 'items.product.kitchenStation', 'table'],
      })) as Order;

      this.emitTransitionEvent(createdOrder, OrderStatus.CREATED);

      if (business.features?.includes(BusinessFeature.QR_ORDERING)) {
        createdOrder = await this.transitionOrder(createdOrder, OrderStatus.CONFIRMED);
        createdOrder = await this.transitionOrder(createdOrder, OrderStatus.IN_KITCHEN);
      }

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

  async findAll(businessId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { businessId },
      relations: ['items', 'items.product', 'items.product.kitchenStation', 'table'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, businessId },
      relations: ['items', 'items.product', 'items.product.kitchenStation', 'table', 'waiter'],
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
  ): Promise<Order> {
    const order = await this.findOne(businessId, id);

    if (dto.status === OrderStatus.CANCELLED) {
      this.orderTransitionService.assertCancellationPermission(actorRole, order.status);
    }

    return this.transitionOrder(order, dto.status);
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

  async processPaymentWebhook(
    orderId: string,
    businessId: string,
    event: 'success' | 'failure' | 'refund',
  ): Promise<Order> {
    const order = await this.findOne(businessId, orderId);

    if (event === 'success') {
      return this.transitionOrder(order, OrderStatus.CLOSED);
    }

    if (event === 'failure') {
      return this.transitionOrder(order, OrderStatus.PAYMENT_FAILED);
    }

    return this.transitionOrder(order, OrderStatus.REFUNDED);
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

    await this.paymentRepository.save(
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

    return this.transitionOrder(order, OrderStatus.CLOSED);
  }

  private async transitionOrder(order: Order, next: OrderStatus): Promise<Order> {
    this.orderTransitionService.assertTransition(order.type, order.status, next);
    order.status = next;
    const updatedOrder = await this.orderRepository.save(order);
    this.emitTransitionEvent(updatedOrder, next);

    if (updatedOrder.tableSessionId) {
      await this.tableSessionsService.refreshLifecycle(updatedOrder.tableSessionId);
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

  private emitTransitionEvent(order: Order, status: OrderStatus): void {
    switch (status) {
      case OrderStatus.CREATED:
        this.kitchenGateway.emitOrderCreated(order);
        break;
      case OrderStatus.CONFIRMED:
        this.kitchenGateway.emitOrderConfirmed(order);
        break;
      case OrderStatus.IN_KITCHEN:
        this.kitchenGateway.emitOrderInKitchen(order);
        break;
      case OrderStatus.READY:
        this.kitchenGateway.emitOrderReady(order);
        break;
      case OrderStatus.DELIVERED:
        this.kitchenGateway.emitOrderDelivered(order);
        break;
      case OrderStatus.CLOSED:
        this.kitchenGateway.emitOrderClosed(order);
        break;
      case OrderStatus.CANCELLED:
        this.kitchenGateway.emitOrderCancelled(order);
        break;
      case OrderStatus.PAYMENT_FAILED:
        this.kitchenGateway.emitOrderPaymentFailed(order);
        break;
      case OrderStatus.REFUNDED:
        this.kitchenGateway.emitOrderRefunded(order);
        break;
      default:
        break;
    }
  }
}
