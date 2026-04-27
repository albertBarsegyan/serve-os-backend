import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { Product } from '@modules/menu/entities/product.entity';
import { KitchenGateway } from '@modules/kitchen/kitchen.gateway';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
    private kitchenGateway: KitchenGateway,
  ) {}

  async create(businessId: string, dto: CreateOrderDto): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let totalAmount = 0;
      const orderItems: OrderItem[] = [];

      for (const itemDto of dto.items) {
        const product = await this.productRepository.findOne({
          where: { id: itemDto.productId, businessId },
        });

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${itemDto.productId} not found`,
          );
        }

        const unitPrice = Number(product.price);
        totalAmount += unitPrice * itemDto.quantity;

        const orderItem = this.orderItemRepository.create({
          productId: product.id,
          quantity: itemDto.quantity,
          unitPrice: unitPrice,
          notes: itemDto.notes,
        });
        orderItems.push(orderItem);
      }

      const order = this.orderRepository.create({
        businessId,
        tableId: dto.tableId,
        staffId: dto.staffId,
        totalAmount,
        sessionToken: dto.sessionToken,
        status: OrderStatus.PENDING,
        items: orderItems,
      });

      const savedOrder = await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();

      return savedOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(businessId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { businessId },
      relations: ['items', 'items.product', 'table'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, businessId },
      relations: ['items', 'items.product', 'table'],
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
  ): Promise<Order> {
    const order = await this.findOne(businessId, id);

    // Validate transition
    this.validateStatusTransition(order.status, dto.status);

    order.status = dto.status;
    const updatedOrder = await this.orderRepository.save(order);

    if (dto.status === OrderStatus.CONFIRMED) {
      this.kitchenGateway.emitNewOrder(updatedOrder);
    }

    return updatedOrder;
  }

  private validateStatusTransition(current: OrderStatus, next: OrderStatus) {
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY],
      [OrderStatus.READY]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.CLOSED],
      [OrderStatus.CLOSED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!transitions[current].includes(next)) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${next}`,
      );
    }
  }
}
