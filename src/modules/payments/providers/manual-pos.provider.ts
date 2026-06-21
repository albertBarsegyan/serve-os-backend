import { Injectable } from '@nestjs/common';
import type { InitiateResult, PaymentProvider, VerifyResult } from './payment-provider.interface';
import type { Order } from '@modules/orders/entities/order.entity';
import type { PaymentMethodConfig } from '@common/enums/payment.enum';

@Injectable()
export class ManualPosProvider implements PaymentProvider {
  // Staff brings the POS terminal to the table; payment is settled ON_PREMISE.
  initiate(_order: Order, _config: PaymentMethodConfig): Promise<InitiateResult> {
    return Promise.resolve({ kind: 'manual' });
  }

  verify(_providerRef: string, _config: PaymentMethodConfig): Promise<VerifyResult> {
    return Promise.resolve('PENDING');
  }
}
