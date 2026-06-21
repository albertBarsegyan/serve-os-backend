import type { Order } from '@modules/orders/entities/order.entity';
import type { PaymentMethodConfig } from '@common/enums/payment.enum';

export type InitiateResult =
  | { kind: 'redirect'; url: string; providerRef: string }
  | { kind: 'instant'; providerRef: string }
  | { kind: 'manual' };

export type VerifyResult = 'PAID' | 'PENDING' | 'FAILED';

export interface PaymentProvider {
  initiate(order: Order, config: PaymentMethodConfig): Promise<InitiateResult>;
  verify(providerRef: string, config: PaymentMethodConfig): Promise<VerifyResult>;
}
