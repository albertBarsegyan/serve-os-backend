import { EntityManager } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '@common/enums/payment.enum';

/**
 * Recomputes total confirmed tip money for an order from Payment.tipAmount (the source of
 * truth). Callers assign the result to Order.tipAmount, which is only a denormalized read
 * cache — this keeps the guest tip route (table-sessions module) and the staff tip routes
 * (orders module) from clobbering each other's writes, since both funnel through this same
 * SUM instead of each doing its own flat overwrite.
 *
 * Pass a transactional EntityManager when called inside a locked transaction so the SUM
 * observes the row(s) just written in that same transaction.
 */
export async function recomputeOrderTipAmount(
  manager: EntityManager,
  orderId: string,
): Promise<number> {
  const row = await manager
    .createQueryBuilder(Payment, 'p')
    .select('COALESCE(SUM(p.tipAmount), 0)', 'total')
    .where('p."orderId" = :orderId AND p.status = :status', {
      orderId,
      status: PaymentStatus.CONFIRMED,
    })
    .getRawOne<{ total: string }>();

  return Number(row?.total ?? 0);
}
