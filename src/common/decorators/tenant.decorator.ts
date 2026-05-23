import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '@common/types/authenticated-request.type';

export const Tenant = createParamDecorator(
  (required: boolean | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const businessId = request.businessId ?? null;

    if (required !== false && !businessId) {
      throw new BadRequestException('Business context required');
    }

    return businessId;
  },
);
