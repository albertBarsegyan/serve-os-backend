import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import {
  Order,
  PaymentMethod,
  PaymentStatus as OrderPaymentStatus,
} from '@modules/orders/entities/order.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private dataSource: DataSource,
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
      this.confirmOnlinePayment(savedPayment.id);
    }

    return savedPayment;
  }

  private confirmOnlinePayment(paymentId: string) {
    // Simulate async webhook
    setTimeout(() => {
      this.confirmPayment(paymentId, null);
    }, 2000);
  }

  async confirmPayment(
    paymentId: string,
    staffId: string | null,
  ): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { id: paymentId },
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
      payment.confirmedBy = staffId;

      const updatedPayment = await queryRunner.manager.save(Payment, payment);

      // Update order payment status
      const order = payment.order;
      order.paymentStatus = OrderPaymentStatus.PAID;
      await queryRunner.manager.save(Order, order);

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
