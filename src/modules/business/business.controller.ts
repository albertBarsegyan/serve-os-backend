import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import { AuthUser } from '@common/decorators/auth-user.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { Public } from '@common/decorators/public.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import type { AuthenticatedUser } from '@common/types/authenticated-request.type';

@ApiTags('Business')
@ApiBearerAuth()
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Create a new business' })
  @ApiResponse({ status: 201, description: 'Business successfully created' })
  create(
    @Tenant(false) _businessId: null,
    @Body() createBusinessDto: CreateBusinessDto,
    @AuthUser() authUser: AuthenticatedUser,
  ) {
    return this.businessService.create(createBusinessDto, authUser);
  }

  @Get()
  @AllowWithoutBusiness()
  @ApiOperation({ summary: 'Get all businesses for current user' })
  findAll(@AuthUser() authUser: AuthenticatedUser) {
    return this.businessService.findAll(authUser.id);
  }

  @Roles(Role.OWNER)
  @Get(':id')
  @ApiOperation({ summary: 'Get a business by ID' })
  @ApiResponse({ status: 200, description: 'Business found' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  findOne(@Param('id') id: string, @AuthUser() authUser: { id: string }) {
    return this.businessService.findOne(id, authUser.id);
  }

  @Roles(Role.OWNER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a business' })
  update(
    @Param('id') id: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
    @AuthUser() authUser: { id: string },
  ) {
    return this.businessService.update(id, authUser.id, updateBusinessDto);
  }

  @Roles(Role.OWNER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a business' })
  remove(@Param('id') id: string, @AuthUser() authUser: { id: string }) {
    return this.businessService.remove(id, authUser.id);
  }
}
