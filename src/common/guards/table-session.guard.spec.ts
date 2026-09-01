import { ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { TableSessionGuard } from './table-session.guard';
import { TableSessionsService } from '@modules/table-sessions/table-sessions.service';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import type { TableSession } from '@modules/table-sessions/table-session.entity';
import type { Order } from '@modules/orders/entities/order.entity';

function makeContext(req: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('TableSessionGuard', () => {
  let service: {
    getActiveByToken: jest.Mock;
    getMostRecentOrderForSession: jest.Mock;
  };
  let guard: TableSessionGuard;

  beforeEach(() => {
    service = {
      getActiveByToken: jest.fn(),
      getMostRecentOrderForSession: jest.fn(),
    };
    guard = new TableSessionGuard(service as unknown as TableSessionsService);
  });

  it('rejects when no sessionToken route param is present', async () => {
    const req = { params: {} } as unknown as AuthenticatedRequest;
    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(UnauthorizedException);
    expect(service.getActiveByToken).not.toHaveBeenCalled();
  });

  it('propagates ForbiddenException for an invalid/expired/closed session token', async () => {
    service.getActiveByToken.mockRejectedValueOnce(
      new ForbiddenException('Invalid or expired sessionToken'),
    );
    const req = { params: { sessionToken: 'bad-token' } } as unknown as AuthenticatedRequest;

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the session has no order to tip', async () => {
    service.getActiveByToken.mockResolvedValueOnce({
      id: 'session-1',
      businessId: 'b-1',
    });
    service.getMostRecentOrderForSession.mockResolvedValueOnce(null);
    const req = { params: { sessionToken: 'good-token' } } as unknown as AuthenticatedRequest;

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(NotFoundException);
  });

  it('resolves req.tableSession, req.businessId, and req.order on success', async () => {
    const session = { id: 'session-1', businessId: 'b-1' } as TableSession;
    const order = { id: 'order-1' } as Order;
    service.getActiveByToken.mockResolvedValueOnce(session);
    service.getMostRecentOrderForSession.mockResolvedValueOnce(order);
    const req = { params: { sessionToken: 'good-token' } } as unknown as AuthenticatedRequest;

    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req.tableSession).toBe(session);
    expect(req.businessId).toBe('b-1');
    expect(req.order).toBe(order);
  });
});
