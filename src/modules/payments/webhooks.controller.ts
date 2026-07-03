import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@common/decorators/public.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { PaymentsService } from './payments.service';
import { ProviderRegistryService } from './providers/provider-registry.service';

// This is a @Public() endpoint with no signature verification (verify() re-queries the
// provider directly, so a forged body can't force a false confirm) — but nothing stops an
// unauthenticated caller from enumerating providerRefs and forcing repeated outbound verify()
// calls to the payment provider. Throttle it like the other public/unauthenticated endpoints
// (auth, session scan, guest order creation) rather than leaving it uncapped.
const WEBHOOK_THROTTLE = { default: { limit: 20, ttl: 60000 } };

class CallbackBodyDto {
  @ApiProperty({ description: 'Provider-assigned reference stored when payment was initiated' })
  @IsString()
  providerRef: string;

  @ApiProperty({ required: false, description: 'Raw provider payload (ignored for verification)' })
  @IsOptional()
  payload?: unknown;
}

@ApiTags('Webhooks')
@Controller()
export class WebhooksController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {}

  /**
   * Bank/provider callback — server-side re-verification, never trusts the POST body as proof.
   * Each provider slug maps to a registered PaymentProvider whose verify() re-queries the bank.
   */
  @Public()
  @AllowWithoutBusiness()
  @Post('payments/callback/:provider')
  @UseGuards(ThrottlerGuard)
  @Throttle(WEBHOOK_THROTTLE)
  @ApiOperation({
    summary: 'Provider payment callback — re-verifies server-side before confirming',
  })
  async handleCallback(@Param('provider') providerSlug: string, @Body() body: CallbackBodyDto) {
    const provider = this.providerRegistry.get(providerSlug);
    const verifyResult = await provider.verify(body.providerRef, {} as never);

    if (verifyResult === 'FAILED') {
      const payment = await this.paymentsService.findByProviderRef(body.providerRef);
      if (payment) {
        await this.paymentsService.failPayment(
          payment.id,
          payment.businessId,
          'Provider callback reported failure',
        );
      }
      return { received: true, status: verifyResult };
    }

    if (verifyResult !== 'PAID') {
      return { received: true, status: verifyResult };
    }

    const payment = await this.paymentsService.findByProviderRef(body.providerRef);
    if (!payment) {
      return { received: true, status: 'NOT_FOUND' };
    }

    await this.paymentsService.confirmPayment(payment.id, payment.businessId, null);
    return { received: true, status: 'CONFIRMED' };
  }
}
