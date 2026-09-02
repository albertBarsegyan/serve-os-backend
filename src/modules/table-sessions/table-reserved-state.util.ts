import { EntityManager } from 'typeorm';
import { TableSession } from './table-session.entity';
import { Table } from '@modules/tables/entities/table.entity';

/**
 * Recomputes Table.isReserved from whether any session is still active for that table,
 * rather than the caller unconditionally writing true/false — a table can now carry
 * several concurrent sessions (separate guest parties), so closing/reactivating just ONE
 * of them must never flip isReserved for a table other sessions are still occupying.
 *
 * Pass a transactional EntityManager when called inside a locked transaction so the count
 * observes the row(s) just written in that same transaction.
 */
export async function syncTableReservedState(
  manager: EntityManager,
  tableId: string,
): Promise<void> {
  const activeCount = await manager.count(TableSession, { where: { tableId, isActive: true } });
  await manager.update(Table, { id: tableId }, { isReserved: activeCount > 0 });
}
