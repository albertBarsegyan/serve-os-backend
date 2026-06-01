import { Injectable, ForbiddenException } from '@nestjs/common';
import { UnifiedAuthGuard } from './unified-auth.guard';
import type { AuthPayload } from '../types/auth-payload.type';

@Injectable()
export class OwnerOnlyGuard extends UnifiedAuthGuard {
  handleRequest(err: any, payload: any, _info: any): any {
    // First, call parent to validate JWT
    const validatedPayload = super.handleRequest(err, payload, _info) as AuthPayload;

    // Then check if it's an owner
    if (validatedPayload.type !== 'owner') {
      throw new ForbiddenException('Owner access required');
    }

    return validatedPayload;
  }
}
