import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { PermissionGuard } from '@common/guards/permission.guard';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthUser } from '@common/decorators/auth-user.decorator';
import { Role } from '@common/enums/role.enum';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(TenantGuard, PermissionGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Initiate a payment (businessId resolved from order when no cookie)' })
  @ApiResponse({ status: 201, description: 'Payment record created' })
  create(@Tenant(false) businessId: string | null, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.WAITER)
  @Get()
  @ApiOperation({ summary: 'Get all payments for the business' })
  findAll(@Tenant(true) businessId: string) {
    return this.paymentsService.findAll(businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.WAITER)
  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm a payment (Staff only)' })
  @ApiResponse({ status: 200, description: 'Payment confirmed' })
  confirm(
    @Tenant(true) businessId: string,
    @Param('id') id: string,
    @AuthUser() authUser: { id: string },
  ) {
    return this.paymentsService.confirmPayment(id, businessId, authUser.id);
  }
}
