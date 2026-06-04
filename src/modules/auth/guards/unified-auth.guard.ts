import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedRequest } from '@common/types/authenticated-request.type';

@Injectable()
export class UnifiedAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, payload: any, _info: any): any {
    if (err || !payload) {
      throw err || new UnauthorizedException('Invalid or missing authentication token');
    }

    return payload;
  }

  canActivate(context: ExecutionContext) {
    const result = super.canActivate(context);

    if (result instanceof Promise) {
      return result.then(() => this.attachAuthFieldsToRequest(context));
    }

    return this.attachAuthFieldsToRequest(context);
  }

  private attachAuthFieldsToRequest(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = request.user;

    if (!payload) {
      return false;
    }

    // Attach typed fields to request based on principal type
    if (payload.type === 'owner') {
      request.ownerId = payload.userId;
      request.userEmail = payload.email;
    } else if (payload.type === 'staff') {
      request.staffId = payload.staffId;
      request.businessId = payload.businessId;
      request.staffRole = payload.role;
    }

    // Always attach the full authPayload
    request.authPayload = payload;

    return true;
  }
}
