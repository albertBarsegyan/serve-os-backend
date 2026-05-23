import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { Product } from '@modules/menu/entities/product.entity';
import { KitchenGateway } from '@modules/kitchen/kitchen.gateway';
import { Table } from '@modules/tables/entities/table.entity';
import { Staff } from '@modules/staff/entities/staff.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly kitchenGateway: KitchenGateway,
  ) {}

  async create(businessId: string, dto: CreateOrderDto): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let totalAmount = 0;
      const orderItems: OrderItem[] = [];

      const table = await queryRunner.manager.findOne(Table, {
        where: { id: dto.tableId, businessId },
      });

      if (!table) {
        throw new NotFoundException(`Table with ID ${dto.tableId} not found`);
      }

      let staffId: string | undefined;

      if (dto.staffId) {
        const staff = await queryRunner.manager.findOne(Staff, {
          where: { id: dto.staffId, businessId },
        });

        if (!staff) {
          throw new NotFoundException(`Staff with ID ${dto.staffId} not found`);
        }

        staffId = staff.id;
      }

      for (const itemDto of dto.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: itemDto.productId, businessId },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${itemDto.productId} not found`);
        }

        const unitPrice = Number(product.price);
        totalAmount += unitPrice * itemDto.quantity;

        const orderItem = queryRunner.manager.create(OrderItem, {
          productId: product.id,
          quantity: itemDto.quantity,
          unitPrice,
          notes: itemDto.notes,
        });

        orderItems.push(orderItem);
      }

      const order = new Order();
      order.businessId = businessId;
      order.tableId = dto.tableId;
      order.waiterId = staffId as string;
      order.totalAmount = totalAmount;
      order.customerSessionId = dto.sessionToken as string;
      order.status = OrderStatus.PENDING;

      const savedOrder = await queryRunner.manager.save(order);

      // IMPORTANT: attach order to items
      for (const item of orderItems) {
        item.order = savedOrder;
      }

      await queryRunner.manager.save(orderItems);

      await queryRunner.commitTransaction();

      return (await queryRunner.manager.findOne(Order, {
        where: { id: savedOrder.id },
        relations: ['items', 'items.product', 'table'],
      })) as Order;
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

  async updateStatus(businessId: string, id: string, dto: UpdateOrderStatusDto): Promise<Order> {
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
      throw new BadRequestException(`Invalid status transition from ${current} to ${next}`);
    }
  }
}
