import { Injectable, NestMiddleware } from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request & { businessId?: string | null }, _res: Response, next: NextFunction) {
    const rawBusinessId = req.headers['x-business-id'];
    const businessId = Array.isArray(rawBusinessId) ? rawBusinessId[0] : rawBusinessId;

    if (typeof businessId === 'string' && businessId.trim().length > 0 && isUuid(businessId)) {
      req.businessId = businessId;
    } else {
      req.businessId = null;
    }

    next();
  }
}
