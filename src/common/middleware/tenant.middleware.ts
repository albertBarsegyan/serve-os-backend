import { Injectable, NestMiddleware } from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { NextFunction, Request, Response } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TableSession } from '@modules/table-sessions/table-session.entity';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async use(req: Request & { businessId?: string | null }, _res: Response, next: NextFunction) {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const rawBusinessId =
      cookies && typeof cookies['business_id'] === 'string' ? cookies['business_id'] : undefined;

    if (
      typeof rawBusinessId === 'string' &&
      rawBusinessId.trim().length > 0 &&
      isUuid(rawBusinessId)
    ) {
      req.businessId = rawBusinessId;
      return next();
    }

    // Fallback: if no valid business_id cookie but a customer session token exists,
    // resolve businessId from the session row to avoid requiring the client to
    // send business_id separately on re-entry.
    const sessionToken =
      cookies && typeof cookies['customer_session_token'] === 'string'
        ? cookies['customer_session_token']
        : undefined;

    if (sessionToken) {
      const session = await this.dataSource.getRepository(TableSession).findOne({
        where: { sessionToken, isActive: true },
        select: ['businessId'],
      });
      if (session) {
        req.businessId = session.businessId;
        return next();
      }
    }

    req.businessId = null;
    next();
  }
}
