import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, QueryFailedError, Repository } from 'typeorm';
import { TableSession } from './table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { KitchenGateway } from '@modules/kitchen/kitchen.gateway';

// Exported so callers (e.g. OrdersService) can tell upfront whether a transition could
// possibly leave zero open orders on a session, without duplicating this list.
export const OPEN_ORDER_STATUSES = [
  OrderStatus.CREATED,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_KITCHEN,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
];

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function newExpiresAt(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

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
    private readonly kitchenGateway: KitchenGateway,
  ) {}

  async scan(qrCode: string) {
    const table = await this.tableRepository.findOne({ where: { qrCode, isActive: true } });
    if (!table) {
      throw new NotFoundException('Table not found or inactive');
    }

    const business = await this.businessRepository.findOne({
      where: { id: table.businessId, isActive: true },
      relations: ['paymentMethods'],
    });
    if (!business) {
      throw new NotFoundException('Business not found or inactive');
    }

    const session = await this.findOrCreateForTable(table.businessId, table.id);

    return {
      sessionToken: session.sessionToken,
      tableSessionId: session.id,
      businessId: session.businessId,
      tableId: session.tableId,
      tableName: `Table ${table.number}`,
      businessName: business.name,
      businessLogoUrl: business.logoUrl ?? null,
      paymentMethods: (business.paymentMethods ?? [])
        .filter((m) => m.isActive && !m.deletedAt)
        .map((m) => ({ method: m.method, isActive: m.isActive })),
    };
  }

  async resumeByToken(token: string) {
    const session = await this.tableSessionRepository.findOne({
      where: { sessionToken: token, isActive: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found or inactive');
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new NotFoundException('Session expired');
    }

    const [table, business] = await Promise.all([
      this.tableRepository.findOne({ where: { id: session.tableId } }),
      this.businessRepository.findOne({
        where: { id: session.businessId },
        relations: ['paymentMethods'],
      }),
    ]);

    if (!table || !business) {
      throw new NotFoundException('Session data incomplete');
    }

    return {
      sessionToken: session.sessionToken,
      tableSessionId: session.id,
      businessId: session.businessId,
      tableId: session.tableId,
      tableName: `Table ${table.number}`,
      businessName: business.name,
      businessLogoUrl: business.logoUrl ?? null,
      paymentMethods: (business.paymentMethods ?? [])
        .filter((m) => m.isActive && !m.deletedAt)
        .map((m) => ({ method: m.method, isActive: m.isActive })),
    };
  }

  async bumpExpiresAt(sessionId: string): Promise<void> {
    await this.tableSessionRepository.update(
      { id: sessionId, isActive: true },
      { expiresAt: newExpiresAt() },
    );
  }

  async findOrCreateForTable(businessId: string, tableId: string): Promise<TableSession> {
    const existing = await this.tableSessionRepository.findOne({
      where: { businessId, tableId, isActive: true },
      order: { openedAt: 'DESC' },
    });

    if (existing) {
      return existing;
    }

    try {
      const session = await this.tableSessionRepository.save(
        this.tableSessionRepository.create({
          businessId,
          tableId,
          sessionToken: generateSessionToken(),
          isActive: true,
          closedAt: null,
          expiresAt: newExpiresAt(),
        }),
      );
      await this.tableRepository.update({ id: tableId }, { isReserved: true });
      return session;
    } catch (error) {
      // A concurrent scan won the race and already holds the partial unique index
      // on (tableId) WHERE isActive — fall back to joining its session instead of erroring.
      if (this.isActiveSessionConflict(error)) {
        const winner = await this.tableSessionRepository.findOne({
          where: { businessId, tableId, isActive: true },
          order: { openedAt: 'DESC' },
        });
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
  }

  private isActiveSessionConflict(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError: unknown = error.driverError;
    const code =
      driverError && typeof driverError === 'object' && 'code' in driverError
        ? driverError.code
        : undefined;
    return code === '23505';
  }

  async getActiveByToken(sessionToken: string): Promise<TableSession> {
    const session = await this.tableSessionRepository.findOne({
      where: { sessionToken, isActive: true },
    });

    if (!session) {
      throw new ForbiddenException('Invalid or expired sessionToken');
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new ForbiddenException('Session has expired');
    }

    return session;
  }

  async getBillBySession(sessionId: string, businessId: string) {
    const session = await this.tableSessionRepository.findOne({
      where: { id: sessionId, businessId },
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
    await this.tableSessionRepository.save(session);
    await this.tableRepository.update({ id: session.tableId }, { isReserved: false });
    this.kitchenGateway.emitSessionClosed(session.sessionToken, session.id);
    return session;
  }

  /** Auto-closes the session once its last order settles (e.g. fully paid) — this is
   * what tells a customer's browser to clear its stored session credentials after
   * the "all done" state, without staff having to close the session manually. */
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
      await this.tableRepository.update({ id: session.tableId }, { isReserved: false });
      this.kitchenGateway.emitSessionClosed(session.sessionToken, session.id);
    }
  }
}
