import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';

/**
 * Per-session-token rate limit for the guest tip route, keyed independently of the global
 * per-IP ThrottlerGuard (multiple guests can share a NAT/IP at a busy venue, and a single
 * session token being hammered — script or a stuck retry loop — shouldn't need to exhaust
 * an entire IP's budget to get caught). In-memory sliding window, same style as
 * KitchenGateway's callWaiterCooldowns — no shared-storage precedent exists in this codebase
 * for per-key throttling, and a single-process in-memory map is consistent with that.
 */
@Injectable()
export class TipRateLimitGuard implements CanActivate {
  private static readonly WINDOW_MS = 60_000;
  private static readonly MAX_PER_TOKEN = 5;

  private readonly hits = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const param = req.params?.sessionToken;
    const sessionToken = Array.isArray(param) ? param[0] : param;
    if (!sessionToken) return true; // TableSessionGuard rejects a missing token separately.

    const now = Date.now();
    const recent = (this.hits.get(sessionToken) ?? []).filter(
      (t) => now - t < TipRateLimitGuard.WINDOW_MS,
    );

    if (recent.length >= TipRateLimitGuard.MAX_PER_TOKEN) {
      throw new ThrottlerException('Too many tip attempts for this session, try again shortly');
    }

    recent.push(now);
    this.hits.set(sessionToken, recent);

    // Opportunistic cleanup so long-lived processes don't accumulate stale tokens forever.
    if (this.hits.size > 10_000) {
      for (const [key, timestamps] of this.hits) {
        if (timestamps.every((t) => now - t >= TipRateLimitGuard.WINDOW_MS)) {
          this.hits.delete(key);
        }
      }
    }

    return true;
  }
}
