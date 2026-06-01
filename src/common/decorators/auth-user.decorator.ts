import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '@common/types/authenticated-request.type';

export const AuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { id: string } | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = request.user;

    if (!payload) {
      return undefined;
    }

    return {
      id: payload.type === 'owner' ? payload.userId : payload.staffId,
    };
  },
);
