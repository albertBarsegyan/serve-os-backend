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
      this.logger.debug(
        {
          path: request.url,
          method: request.method,
          userId: request.user?.id,
          businessId: request.businessId,
        },
        'Tenant business context resolved for request',
      );
    }

    return next.handle();
  }
}
