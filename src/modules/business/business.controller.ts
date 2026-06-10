import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { CreateBusinessDto, UpdateBusinessDto, UpsertPaymentMethodDto } from './dto/business.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { Tenant } from '@common/decorators/tenant.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import type { Response } from 'express';
import { setBusinessCookie } from '@common/utils/business.utils';
import { ConfigService } from '@nestjs/config';
import { UnifiedAuthGuard } from '@modules/auth/guards/unified-auth.guard';
import { GetAuthPayload } from '@modules/auth/decorators/auth-payload.decorator';
import type { AuthPayload } from '@modules/auth/types/auth-payload.type';

@ApiTags('Business')
@ApiBearerAuth()
@Controller('business')
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(UnifiedAuthGuard)
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Create a new business' })
  @ApiResponse({ status: 201, description: 'Business successfully created' })
  async create(
    @Tenant(false) _businessId: null,
    @Body() createBusinessDto: CreateBusinessDto,
    @GetAuthPayload() authPayload: AuthPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (authPayload.type !== 'owner') {
      throw new ForbiddenException('Only owners can create businesses');
    }

    const createdBusiness = await this.businessService.create(createBusinessDto, authPayload);

    setBusinessCookie({
      res,
      businessId: createdBusiness.id,
      isProduction: this.configService.get<string>('NODE_ENV') === 'production',
    });

    return createdBusiness;
  }

  @Get()
  @UseGuards(UnifiedAuthGuard)
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Get all businesses for current user' })
  findAll(@GetAuthPayload() authPayload: AuthPayload) {
    return this.businessService.findAll(authPayload);
  }

  @UseGuards(UnifiedAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get a business by ID' })
  @ApiResponse({ status: 200, description: 'Business found' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  findOne(@Param('id') id: string, @GetAuthPayload() authPayload: AuthPayload) {
    return this.businessService.findOne(id, authPayload);
  }

  @Roles(Role.OWNER, StaffRole.MANAGER)
  @UseGuards(UnifiedAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a business' })
  update(
    @Param('id') id: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
    @GetAuthPayload() authPayload: AuthPayload,
  ) {
    return this.businessService.update(id, authPayload, updateBusinessDto);
  }

  @Roles(Role.OWNER)
  @UseGuards(UnifiedAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a business' })
  remove(@Param('id') id: string, @GetAuthPayload() authPayload: AuthPayload) {
    return this.businessService.remove(id, authPayload);
  }

  @Roles(Role.OWNER)
  @UseGuards(UnifiedAuthGuard)
  @Get(':id/payment-methods')
  @ApiOperation({ summary: 'Get payment method configurations for a business' })
  getPaymentMethods(@Param('id') id: string, @GetAuthPayload() authPayload: AuthPayload) {
    return this.businessService.getPaymentMethods(id, authPayload);
  }

  @Roles(Role.OWNER)
  @UseGuards(UnifiedAuthGuard)
  @Put(':id/payment-methods')
  @ApiOperation({ summary: 'Create or update a payment method configuration' })
  upsertPaymentMethod(
    @Param('id') id: string,
    @Body() dto: UpsertPaymentMethodDto,
    @GetAuthPayload() authPayload: AuthPayload,
  ) {
    return this.businessService.upsertPaymentMethod(id, authPayload, dto);
  }

  @Roles(Role.OWNER)
  @UseGuards(UnifiedAuthGuard)
  @Delete(':id/payment-methods/:methodId')
  @ApiOperation({ summary: 'Remove a payment method configuration' })
  deletePaymentMethod(
    @Param('id') id: string,
    @Param('methodId') methodId: string,
    @GetAuthPayload() authPayload: AuthPayload,
  ) {
    return this.businessService.deletePaymentMethod(id, methodId, authPayload);
  }
}
