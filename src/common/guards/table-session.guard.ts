import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TableSessionsService } from '@modules/table-sessions/table-sessions.service';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';

/**
 * Gates routes where the path's :sessionToken is the guest's only credential — it both
 * authenticates the request and resolves the tenant. Unlike GuestSessionGuard (cookie/header
 * token, used for order placement), this reads the token from the route param and additionally
 * resolves the session's associated order, since a session-token-scoped write (e.g. a tip)
 * always targets one specific order. Order-state eligibility for that write is NOT decided
 * here — it's re-checked inside the locked transaction that performs the write, so a stale
 * read here can never authorize a write the transaction wouldn't itself allow.
 */
@Injectable()
export class TableSessionGuard implements CanActivate {
  constructor(private readonly tableSessionsService: TableSessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const param = req.params?.sessionToken;
    const sessionToken = Array.isArray(param) ? param[0] : param;
    if (!sessionToken) {
      throw new UnauthorizedException('Session token required');
    }

    // getActiveByToken throws ForbiddenException for a missing/invalid/inactive/expired
    // token, which already covers "asserts session open".
    const session = await this.tableSessionsService.getActiveByToken(sessionToken);
    const order = await this.tableSessionsService.getMostRecentOrderForSession(session.id);
    if (!order) {
      throw new NotFoundException('No order found for this session');
    }

    req.tableSession = session;
    req.businessId = session.businessId;
    req.order = order;

    return true;
  }
}
