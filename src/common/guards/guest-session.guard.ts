import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TableSessionsService } from '@modules/table-sessions/table-sessions.service';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';

@Injectable()
export class GuestSessionGuard implements CanActivate {
  constructor(private readonly tableSessionsService: TableSessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const cookies = req.cookies as Record<string, string> | undefined;
    const token =
      cookies?.['customer_session_token'] ?? (req.headers['x-session-token'] as string | undefined);

    if (!token) {
      throw new UnauthorizedException('Guest session token required');
    }

    const session = await this.tableSessionsService.getActiveByToken(token);
    req.tableSession = session;
    req.businessId = session.businessId;

    return true;
  }
}
