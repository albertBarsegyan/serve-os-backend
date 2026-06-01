import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { Role } from '@common/enums/role.enum';

@ApiTags('Tables')
@ApiBearerAuth()
@Controller('tables')
@UseGuards(TenantGuard, PermissionGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermission(BusinessFeature.TABLES, 'create')
  @Post()
  @ApiOperation({ summary: 'Create a new table' })
  @ApiResponse({ status: 201, description: 'Table successfully created' })
  create(@Tenant(true) businessId: string, @Body() dto: CreateTableDto) {
    return this.tablesService.create(businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermission(BusinessFeature.TABLES, 'read')
  @Get()
  @ApiOperation({ summary: 'Get all tables for the business' })
  findAll(@Tenant(true) businessId: string) {
    return this.tablesService.findAll(businessId);
  }

  @Public()
  @Get('scan/:qrCode')
  @ApiOperation({ summary: 'Scan QR code to get table info' })
  @ApiResponse({ status: 200, description: 'Table found' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  scanQrCode(@Param('qrCode') qrCode: string) {
    return this.tablesService.findByQrCode(qrCode);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermission(BusinessFeature.TABLES, 'read')
  @Get(':id')
  @ApiOperation({ summary: 'Get a table by ID' })
  findOne(@Tenant(true) businessId: string, @Param('id') id: string) {
    return this.tablesService.findOne(businessId, id);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermission(BusinessFeature.TABLES, 'update')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a table' })
  update(
    @Tenant(true) businessId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateTableDto>,
  ) {
    return this.tablesService.update(businessId, id, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermission(BusinessFeature.TABLES, 'delete')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a table' })
  remove(@Tenant(true) businessId: string, @Param('id') id: string) {
    return this.tablesService.remove(businessId, id);
  }
}
