import { ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthenticatedRequest,
  TenantBusinessContext,
} from '@common/types/authenticated-request.type';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { ALLOW_WITHOUT_BUSINESS_KEY } from '@common/decorators/allow-without-business.decorator';
import { Business } from '@modules/business/entities/business.entity';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';

@Injectable()
export class TenantAccessService {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: PinoLogger,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async resolve(context: import('@nestjs/common').ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const allowWithoutBusiness = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WITHOUT_BUSINESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = request.user;
    const businessId =
      request.businessId ?? (payload?.type === 'staff' ? payload.businessId : null);

    if (!payload) {
      return true;
    }

    if (!businessId) {
      return this.allowMissingBusiness(request, payload, allowWithoutBusiness);
    }

    const found = await this.businessRepository.findOne({
      where: { id: businessId },
      select: ['id', 'ownerId', 'features'],
    });

    if (!found) {
      return this.allowMissingBusinessRecord(request, payload, businessId, allowWithoutBusiness);
    }

    const businessContext = this.buildBusinessContext(
      request,
      payload,
      found,
      businessId,
      allowWithoutBusiness,
    );

    if (!businessContext) {
      return true;
    }

    request.businessId = businessContext.id;
    request.business = businessContext;

    return true;
  }

  private buildBusinessContext(
    request: AuthenticatedRequest,
    payload: AuthPayload,
    found: { id: string; ownerId: string },
    businessId: string,
    allowWithoutBusiness: boolean | undefined,
  ): TenantBusinessContext | null {
    if (payload.type === 'owner') {
      if (found.ownerId !== payload.userId) {
        return this.allowOrDeny(request, payload, businessId, allowWithoutBusiness, 'owner');
      }

      return {
        id: found.id,
        role: null,
        permissions: [...Object.values(BusinessFeature)],
      };
    }

    if (found.id !== payload.businessId) {
      return this.allowOrDeny(request, payload, businessId, allowWithoutBusiness, 'staff');
    }

    return {
      id: found.id,
      role: payload.role,
      permissions: [...Object.values(BusinessFeature)],
    };
  }

  private allowMissingBusiness(
    request: AuthenticatedRequest,
    payload: AuthPayload,
    allowWithoutBusiness: boolean | undefined,
  ): boolean {
    if (allowWithoutBusiness) {
      request.businessId = null;
      request.business = null;
      return true;
    }

    this.logger.warn(
      {
        principalType: payload.type,
        principalId: payload.type === 'owner' ? payload.userId : payload.staffId,
        path: request.url,
        method: request.method,
      },
      'Tenant guard blocked request without business context',
    );
    throw new ForbiddenException('Business context required');
  }

  private allowMissingBusinessRecord(
    request: AuthenticatedRequest,
    payload: AuthPayload,
    businessId: string,
    allowWithoutBusiness: boolean | undefined,
  ): boolean {
    if (allowWithoutBusiness) {
      request.businessId = null;
      request.business = null;
      return true;
    }

    this.logger.warn(
      {
        principalType: payload.type,
        principalId: payload.type === 'owner' ? payload.userId : payload.staffId,
        businessId,
        path: request.url,
        method: request.method,
      },
      'Tenant guard rejected request for missing business',
    );
    throw new ForbiddenException('Invalid tenant access');
  }

  private allowOrDeny(
    request: AuthenticatedRequest,
    payload: AuthPayload,
    businessId: string,
    allowWithoutBusiness: boolean | undefined,
    principalKind: 'owner' | 'staff',
  ): null {
    if (allowWithoutBusiness) {
      request.businessId = null;
      request.business = null;
      return null;
    }

    this.logger.warn(
      {
        principalType: payload.type,
        principalId:
          principalKind === 'owner'
            ? payload.type === 'owner'
              ? payload.userId
              : payload.staffId
            : payload.type === 'staff'
              ? payload.staffId
              : payload.userId,
        businessId,
        path: request.url,
        method: request.method,
      },
      'Tenant guard rejected request for unauthorized business access',
    );
    throw new ForbiddenException('Invalid tenant access');
  }
}
