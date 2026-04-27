import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(TenantGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Initiate a payment' })
  @ApiResponse({ status: 201, description: 'Payment record created' })
  create(@Tenant() businessId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(businessId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all payments for the business' })
  findAll(@Tenant() businessId: string) {
    return this.paymentsService.findAll(businessId);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm a payment (Staff only)' })
  @ApiResponse({ status: 200, description: 'Payment confirmed' })
  confirm(@Param('id') id: string, @Request() req: any) {
    const staffId = req.user.userId;
    return this.paymentsService.confirmPayment(id, staffId);
  }
}
