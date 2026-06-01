import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';
import { AuthenticatedRequest } from '@common/types/authenticated-request.type';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.businessId) {
      const payload = request.user;
      let principalId: string | null = null;

      if (payload?.type === 'owner') {
        principalId = payload.userId;
      } else if (payload?.type === 'staff') {
        principalId = payload.staffId;
      }

      this.logger.debug(
        {
          path: request.url,
          method: request.method,
          userId: principalId,
          businessId: request.businessId,
        },
        'Tenant business context resolved for request',
      );
    }

    return next.handle();
  }
}
