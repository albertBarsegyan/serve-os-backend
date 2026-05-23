import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthenticatedRequest,
  TenantBusinessContext,
} from '@common/types/authenticated-request.type';
import { StaffRole } from '@common/enums/staff-role.enum';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';

function buildPermissions(role: StaffRole): StaffRole[] {
  switch (role) {
    case StaffRole.OWNER:
      return [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.WAITER, StaffRole.CHEF];
    case StaffRole.ADMIN:
      return [StaffRole.ADMIN, StaffRole.WAITER, StaffRole.CHEF];
    case StaffRole.WAITER:
      return [StaffRole.WAITER];
    case StaffRole.CHEF:
      return [StaffRole.CHEF];
    default:
      return [role];
  }
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: PinoLogger,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    const businessId = request.businessId ?? null;

    if (!userId) {
      this.logger.warn(
        {
          userId,
          path: request.url,
          method: request.method,
        },
        'Tenant guard encountered missing user id - possible guard ordering issue',
      );
      throw new InternalServerErrorException(
        'Guard ordering violation: JwtAuthGuard must run before TenantGuard',
      );
    }

    if (!businessId) {
      const allowWithout = this.reflector.getAllAndOverride<boolean>('allowWithoutBusiness', [
        context.getHandler(),
        context.getClass(),
      ]);

      if (allowWithout) {
        request.business = null;
        return true;
      }

      this.logger.warn(
        {
          userId,
          path: request.url,
          method: request.method,
        },
        'Tenant guard blocked request without business context',
      );
      throw new ForbiddenException('Business context required');
    }

    // Single joined query: try to find staff row and include business owner info
    const staffJoined:
      | {
          staff_id: string;
          business_id: string;
          business_ownerId: string;
          staff_role: StaffRole;
        }
      | undefined = await this.staffRepository
      .createQueryBuilder('staff')
      .leftJoin('staff.business', 'business')
      .select([
        'staff.id as staff_id',
        'staff.role as staff_role',
        'business.id as business_id',
        'business."ownerId" as business_ownerId',
      ])
      .where('staff.userId = :userId', { userId })
      .andWhere('business.id = :businessId', { businessId })
      .getRawOne();

    let business: { id: string; ownerId: string } | null = null;
    let contextRole: StaffRole;

    if (staffJoined) {
      business = {
        id: staffJoined.business_id,
        ownerId: staffJoined.business_ownerId,
      };
      contextRole = staffJoined.staff_role;
    } else {
      // No staff row found — maybe the requester is the owner. Fetch business to verify.
      const found = await this.businessRepository.findOne({
        where: { id: businessId },
        select: ['id', 'ownerId'],
      });

      if (!found) {
        this.logger.warn(
          {
            userId,
            businessId,
            path: request.url,
            method: request.method,
          },
          'Tenant guard rejected request for missing business',
        );
        throw new ForbiddenException('Invalid tenant access');
      }

      business = { id: found.id, ownerId: found.ownerId };

      if (found.ownerId === userId) {
        contextRole = StaffRole.OWNER;
      } else {
        this.logger.warn(
          {
            userId,
            businessId,
            path: request.url,
            method: request.method,
          },
          'Tenant guard rejected request for unauthorized business access',
        );
        throw new ForbiddenException('Invalid tenant access');
      }
    }

    const resolvedRole = contextRole;

    const businessContext: TenantBusinessContext = {
      id: business.id,
      role: resolvedRole,
      permissions: buildPermissions(resolvedRole),
    };

    request.businessId = businessContext.id;
    request.business = businessContext;

    return true;
  }
}
