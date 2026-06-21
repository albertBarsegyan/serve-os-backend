import { Injectable } from '@nestjs/common';
import type { PaymentProvider, InitiateResult, VerifyResult } from './payment-provider.interface';
import type { Order } from '@modules/orders/entities/order.entity';
import type { PaymentMethodConfig } from '@common/enums/payment.enum';

@Injectable()
export class CashProvider implements PaymentProvider {
  // Cash is always ON_PREMISE — staff handles collection at the table.
  initiate(_order: Order, _config: PaymentMethodConfig): Promise<InitiateResult> {
    return Promise.resolve({ kind: 'manual' });
  }

  verify(_providerRef: string, _config: PaymentMethodConfig): Promise<VerifyResult> {
    return Promise.resolve('PENDING');
  }
}
