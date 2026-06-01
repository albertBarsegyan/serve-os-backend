import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TenantAccessService } from './tenant-access.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantAccessService: TenantAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.tenantAccessService.resolve(context);
  }
}
