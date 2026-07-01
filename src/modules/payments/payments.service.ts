import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { PaymentMethod, PaymentStatus } from '@common/enums/payment.enum';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { OrdersService } from '@modules/orders/orders.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
  ) {}

  async create(businessId: string | null, dto: CreatePaymentDto): Promise<Payment> {
    const order = await this.orderRepository.findOne({
      where: businessId ? { id: dto.orderId, businessId } : { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    const resolvedBusinessId = businessId ?? order.businessId;

    const payment = this.paymentRepository.create({
      ...dto,
      businessId: resolvedBusinessId,
      status: PaymentStatus.PENDING,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    if (dto.method === PaymentMethod.ONLINE) {
      this.confirmOnlinePayment(savedPayment.id, resolvedBusinessId);
    }

    return savedPayment;
  }

  async confirmPayment(
    paymentId: string,
    businessId: string | null,
    staffId: string | null,
  ): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let confirmedPayment: Payment;
    let alreadyConfirmed = false;

    try {
      // Pessimistic write lock — prevents concurrent double-confirms
      const payment = await queryRunner.manager.findOne(Payment, {
        where: businessId ? { id: paymentId, businessId } : { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);

      if (payment.status === PaymentStatus.CONFIRMED) {
        // Idempotent: already confirmed — return without re-processing
        alreadyConfirmed = true;
        confirmedPayment = payment;
        await queryRunner.commitTransaction();
      } else {
        if (payment.status === PaymentStatus.FAILED) {
          throw new BadRequestException('Cannot confirm a failed payment');
        }
        payment.status = PaymentStatus.CONFIRMED;
        payment.confirmedAt = new Date();
        payment.confirmedById = staffId;
        confirmedPayment = await queryRunner.manager.save(payment);
        await queryRunner.commitTransaction();
      }
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Outside the lock: recompute paymentStatus and advance order lifecycle
    if (!alreadyConfirmed) {
      const order = await this.orderRepository.findOne({
        where: businessId
          ? { id: confirmedPayment.orderId, businessId }
          : { id: confirmedPayment.orderId },
      });
      if (order) {
        await this.ordersService.recomputeAndAdvance(order);
      }
    }

    return confirmedPayment!;
  }

  async findByProviderRef(providerRef: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({ where: { providerRef } });
  }

  async findAll(
    businessId: string,
    pagination: { page: number; limit: number },
  ): Promise<import('@common/types/paginated-response.type').PaginatedResponse<Payment>> {
    const { page, limit } = pagination;
    const [data, total] = await this.paymentRepository.findAndCount({
      where: { businessId },
      relations: ['order'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private confirmOnlinePayment(paymentId: string, businessId: string) {
    void this.confirmPayment(paymentId, businessId, null);
  }
}
