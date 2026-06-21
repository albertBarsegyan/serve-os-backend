import { Injectable, NotImplementedException } from '@nestjs/common';
import type { PaymentProvider, InitiateResult, VerifyResult } from './payment-provider.interface';
import type { Order } from '@modules/orders/entities/order.entity';
import type { PaymentMethodConfig } from '@common/enums/payment.enum';

// B4 STUB — requires bank API endpoints + request signing before it can be completed.
// See the project spec section B4 and ask for: register endpoint, getOrderStatus endpoint,
// signing algorithm (HMAC key? RSA?), and callback verification scheme.
@Injectable()
export class BankRedirectProvider implements PaymentProvider {
  initiate(_order: Order, _config: PaymentMethodConfig): Promise<InitiateResult> {
    throw new NotImplementedException(
      'Bank redirect provider is not yet configured. ' +
        'Provide the register/getOrderStatus endpoints and signing details to complete B4.',
    );
  }

  verify(_providerRef: string, _config: PaymentMethodConfig): Promise<VerifyResult> {
    throw new NotImplementedException('Bank redirect provider is not yet configured.');
  }
}
