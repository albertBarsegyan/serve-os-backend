import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '@common/enums/payment.enum';
import { PaymentsService } from '../payments.service';
import { ProviderRegistryService } from '@modules/payments/providers/provider-registry.service';

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // payments pending > 10 min

@Injectable()
export class PaymentReconcileService implements OnModuleInit, OnModuleDestroy {
  private intervalHandle: NodeJS.Timeout | undefined;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly paymentsService: PaymentsService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly logger: PinoLogger,
  ) {
    logger.setContext(PaymentReconcileService.name);
  }

  onModuleInit() {
    this.intervalHandle = setInterval(() => {
      void this.reconcile().catch((err: unknown) =>
        this.logger.error({ err }, 'Payment reconcile run failed'),
      );
    }, RECONCILE_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  async reconcile(): Promise<void> {
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

    const stuck = await this.paymentRepository.find({
      where: { status: PaymentStatus.PENDING, createdAt: LessThan(threshold) },
      take: 50,
    });

    if (stuck.length === 0) return;

    this.logger.info({ count: stuck.length }, 'Reconciling stuck PENDING payments');

    for (const payment of stuck) {
      if (!payment.providerRef) continue;

      try {
        const provider = this.providerRegistry.get(
          (payment as unknown as { providerName?: string }).providerName ?? 'bank_redirect',
        );
        const result = await provider.verify(payment.providerRef, {} as never);

        if (result === 'PAID') {
          await this.paymentsService.confirmPayment(payment.id, payment.businessId, null);
          this.logger.info({ paymentId: payment.id }, 'Reconcile: confirmed payment');
        } else if (result === 'FAILED') {
          await this.paymentRepository.update(payment.id, { status: PaymentStatus.FAILED });
          this.logger.warn({ paymentId: payment.id }, 'Reconcile: marked payment FAILED');
        }
      } catch (err: unknown) {
        this.logger.warn({ paymentId: payment.id, err }, 'Reconcile: could not verify payment');
      }
    }
  }
}
