import { Injectable, ForbiddenException } from '@nestjs/common';
import { UnifiedAuthGuard } from './unified-auth.guard';
import type { AuthPayload } from '../types/auth-payload.type';

@Injectable()
export class StaffOnlyGuard extends UnifiedAuthGuard {
  handleRequest(err: any, payload: any, _info: any): any {
    // First, call parent to validate JWT
    const validatedPayload = super.handleRequest(err, payload, _info) as AuthPayload;

    // Then check if it's a staff
    if (validatedPayload.type !== 'staff') {
      throw new ForbiddenException('Staff access required');
    }

    return validatedPayload;
  }
}
