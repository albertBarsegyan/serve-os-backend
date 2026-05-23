import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { PaymentMethod, PaymentStatus, OrderPaymentStatus } from '@common/enums/payment.enum';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Staff } from '@modules/staff/entities/staff.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async create(businessId: string, dto: CreatePaymentDto): Promise<Payment> {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId, businessId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    const payment = this.paymentRepository.create({
      ...dto,
      businessId,
      status: PaymentStatus.PENDING,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    if (dto.method === PaymentMethod.ONLINE) {
      // Mock online payment confirmation
      this.confirmOnlinePayment(savedPayment.id, businessId);
    }

    return savedPayment;
  }

  private confirmOnlinePayment(paymentId: string, businessId: string) {
    // Simulate async webhook
    setTimeout(() => {
      void this.confirmPayment(paymentId, businessId, null);
    }, 2000);
  }

  async confirmPayment(
    paymentId: string,
    businessId: string | null,
    userId: string | null,
  ): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = await queryRunner.manager.findOne(Payment, {
        where: businessId ? { id: paymentId, businessId } : { id: paymentId },
        relations: ['order'],
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${paymentId} not found`);
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('Payment is already processed');
      }

      payment.status = PaymentStatus.CONFIRMED;
      payment.confirmedAt = new Date();

      if (businessId && userId) {
        const staff = await queryRunner.manager.findOne(Staff, {
          where: { userId, businessId },
        });

        payment.confirmedBy = staff?.id ?? null;
      } else {
        payment.confirmedBy = null;
      }

      const updatedPayment = await queryRunner.manager.save(payment);

      // Update order payment status
      const order = payment.order;
      order.paymentStatus = OrderPaymentStatus.PAID;
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();
      return updatedPayment;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(businessId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { businessId },
      relations: ['order'],
    });
  }
}
