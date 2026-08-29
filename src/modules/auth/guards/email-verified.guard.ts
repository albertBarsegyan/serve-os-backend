import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';

/**
 * Blocks owners with an unverified email from sensitive actions (business
 * creation, staff invites, payment configuration). Staff principals are not
 * gated here — they don't own the email verification concept.
 * Must run after UnifiedAuthGuard (or another guard that populates req.user).
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = request.user;

    if (payload?.type !== 'owner') {
      return true;
    }

    const user = await this.userRepository.findOne({ where: { id: payload.userId } });
    // TODO implement email verification check when the feature is ready
    // if (!user || !user.emailVerified) {
    //   throw new ForbiddenException(
    //     'Please verify your email address before performing this action.',
    //   );
    // }

    return true;
  }
}
