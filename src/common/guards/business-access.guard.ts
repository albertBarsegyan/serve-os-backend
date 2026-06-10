import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { StaffRole } from '@common/enums/staff-role.enum';

/**
 * Allows access to routes parameterised by :businessId for:
 * 1. Owners who own that business
 * 2. MANAGER staff whose JWT businessId matches the route businessId
 *
 * Drop-in replacement for BusinessOwnerGuard wherever managers must also have access.
 */
@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const payload = (request as { user?: AuthPayload }).user;

    if (!payload) {
      throw new ForbiddenException('Authentication required');
    }

    const businessId = request.params.businessId as string | undefined;
    if (!businessId) {
      throw new ForbiddenException('Business ID not provided in route');
    }

    if (payload.type === 'owner') {
      const business = await this.businessRepository.findOne({
        where: { id: businessId, ownerId: payload.userId },
      });
      if (!business) {
        throw new ForbiddenException('You do not own this business or it does not exist');
      }
      return true;
    }

    if (payload.type === 'staff') {
      if (payload.role !== StaffRole.MANAGER) {
        throw new ForbiddenException('Manager access required');
      }
      if (payload.businessId !== businessId) {
        throw new ForbiddenException('You do not have access to this business');
      }
      return true;
    }

    throw new ForbiddenException('Access denied');
  }
}
