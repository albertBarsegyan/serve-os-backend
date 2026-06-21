import { BadRequestException, Injectable } from '@nestjs/common';
import type { PaymentProvider } from './payment-provider.interface';
import { CashProvider } from './cash.provider';
import { ManualPosProvider } from './manual-pos.provider';
import { BankRedirectProvider } from './bank-redirect.provider';

@Injectable()
export class ProviderRegistryService {
  private readonly registry: Record<string, PaymentProvider>;

  constructor(
    cashProvider: CashProvider,
    manualPosProvider: ManualPosProvider,
    bankRedirectProvider: BankRedirectProvider,
  ) {
    this.registry = {
      cash: cashProvider,
      manual_pos: manualPosProvider,
      bank_redirect: bankRedirectProvider,
    };
  }

  get(providerName: string): PaymentProvider {
    const provider = this.registry[providerName];
    if (!provider) {
      throw new BadRequestException(`Unknown payment provider: "${providerName}"`);
    }
    return provider;
  }
}
