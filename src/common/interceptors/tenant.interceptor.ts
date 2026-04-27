import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    businessId?: string;
  };
  body?: Record<string, unknown>;
};

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (user && user.businessId) {
      if (request.body && typeof request.body === 'object') {
        request.body.businessId = user.businessId;
        this.logger.debug(
          {
            path: request.url,
            method: request.method,
            userId: user.sub,
            businessId: user.businessId,
          },
          'Tenant business context propagated to request body',
        );
      }
    }

    return next.handle();
  }
}
