import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '@modules/business/entities/business.entity';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';

/**
 * Guard to ensure the authenticated user owns the business specified in the route
 */
@Injectable()
export class BusinessOwnerGuard implements CanActivate {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const payload = (request as { user?: AuthPayload }).user;

    if (!payload) {
      throw new ForbiddenException('User not authenticated');
    }

    if (payload.type !== 'owner') {
      throw new ForbiddenException('Owner access required');
    }

    const businessId = request.params.businessId;

    if (!businessId) {
      throw new ForbiddenException('Business ID not provided in route');
    }

    const business = await this.businessRepository.findOne({
      where: {
        id: businessId as string,
        ownerId: payload.userId,
      },
    });

    if (!business) {
      throw new ForbiddenException('You do not own this business or business does not exist');
    }

    return true;
  }
}
