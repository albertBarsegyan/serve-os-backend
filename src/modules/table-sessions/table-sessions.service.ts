import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { TableSession } from './table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';

const OPEN_ORDER_STATUSES = [
  OrderStatus.CREATED,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_KITCHEN,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
];

@Injectable()
export class TableSessionsService {
  constructor(
    @InjectRepository(TableSession)
    private readonly tableSessionRepository: Repository<TableSession>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async scan(qrCode: string) {
    const table = await this.tableRepository.findOne({ where: { qrCode, isActive: true } });
    if (!table) {
      throw new NotFoundException('Table not found or inactive');
    }

    const business = await this.businessRepository.findOne({
      where: { id: table.businessId, isActive: true },
    });
    if (!business) {
      throw new NotFoundException('Business not found or inactive');
    }

    let session = await this.tableSessionRepository.findOne({
      where: { businessId: table.businessId, tableId: table.id, isActive: true },
      order: { openedAt: 'DESC' },
    });

    session ??= await this.tableSessionRepository.save(
      this.tableSessionRepository.create({
        businessId: table.businessId,
        tableId: table.id,
        sessionToken: uuid(),
        isActive: true,
        closedAt: null,
      }),
    );

    return {
      sessionToken: session.sessionToken,
      tableSessionId: session.id,
      businessId: session.businessId,
      tableId: session.tableId,
      tableName: `Table ${table.number}`,
      businessName: business.name,
    };
  }

  async getActiveByToken(sessionToken: string): Promise<TableSession> {
    const session = await this.tableSessionRepository.findOne({
      where: { sessionToken, isActive: true },
    });

    if (!session) {
      throw new ForbiddenException('Invalid or expired sessionToken');
    }

    return session;
  }

  async getBillBySession(sessionId: string) {
    const session = await this.tableSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const orders = await this.orderRepository.find({
      where: { tableSessionId: session.id },
      relations: ['items', 'items.product', 'items.product.kitchenStation'],
      order: { createdAt: 'ASC' },
    });

    const grouped = orders.reduce<Record<string, Order[]>>((acc, order) => {
      const token = order.tableSession?.sessionToken ?? 'unknown';
      if (!acc[token]) {
        acc[token] = [];
      }
      acc[token].push(order);
      return acc;
    }, {});

    const groups = Object.entries(grouped).map(([sessionToken, groupedOrders]) => ({
      sessionToken,
      orders: groupedOrders,
      subtotal: groupedOrders.reduce((sum, current) => sum + Number(current.totalAmount), 0),
      tipTotal: groupedOrders.reduce((sum, current) => sum + Number(current.tipAmount ?? 0), 0),
    }));

    return {
      sessionId: session.id,
      tableId: session.tableId,
      businessId: session.businessId,
      groups,
    };
  }

  async closeSession(sessionId: string, payload?: AuthPayload): Promise<TableSession> {
    // authorization
    if (payload?.type === 'staff') {
      const allowed = [StaffRole.WAITER, StaffRole.MANAGER];
      if (!allowed.includes(payload.role)) {
        throw new ForbiddenException('Only WAITER or MANAGER can close sessions');
      }
    }

    const session = await this.tableSessionRepository.findOne({
      where: { id: sessionId, isActive: true },
    });
    if (!session) {
      throw new NotFoundException('Active session not found');
    }

    const blockingCount = await this.orderRepository.count({
      where: {
        tableSessionId: session.id,
        status: In(OPEN_ORDER_STATUSES),
      },
    });
    if (blockingCount > 0) {
      throw new BadRequestException('Cannot close session with active or unpaid orders');
    }

    session.isActive = false;
    session.closedAt = new Date();
    return this.tableSessionRepository.save(session);
  }

  async refreshLifecycle(sessionId: string): Promise<void> {
    const session = await this.tableSessionRepository.findOne({ where: { id: sessionId } });
    if (!session?.isActive) {
      return;
    }

    const activeCount = await this.orderRepository.count({
      where: OPEN_ORDER_STATUSES.map((status) => ({
        tableSessionId: sessionId,
        status,
      })),
    });

    if (activeCount === 0) {
      session.isActive = false;
      session.closedAt = new Date();
      await this.tableSessionRepository.save(session);
    }
  }
}
