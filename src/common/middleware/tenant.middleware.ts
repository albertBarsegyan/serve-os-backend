import { Injectable, NestMiddleware } from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request & { businessId?: string | null }, _res: Response, next: NextFunction) {
    // Read business selection from cookie if present. This cookie is set by the auth
    // controller when a user selects/switches businesses in the frontend.
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const rawBusinessId =
      cookies && typeof cookies['business_id'] === 'string' ? cookies['business_id'] : undefined;

    if (
      typeof rawBusinessId === 'string' &&
      rawBusinessId.trim().length > 0 &&
      isUuid(rawBusinessId)
    ) {
      req.businessId = rawBusinessId;
    } else {
      req.businessId = null;
    }

    next();
  }
}
