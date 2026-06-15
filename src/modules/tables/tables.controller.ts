import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import {
  CreateTableDto,
  SetTableReservationDto,
  ToggleTableStatusDto,
} from './dto/create-table.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { AuthUser } from '@common/decorators/auth-user.decorator';
import type { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '@modules/images/images.constants';

@ApiTags('Tables')
@ApiBearerAuth()
@Controller('tables')
@UseGuards(TenantGuard, PermissionGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Roles(Role.OWNER, StaffRole.MANAGER)
  @RequirePermission(BusinessFeature.TABLES, 'create')
  @Post()
  @ApiOperation({ summary: 'Create a new table' })
  @ApiResponse({ status: 201, description: 'Table successfully created' })
  create(@Tenant(true) businessId: string, @Body() dto: CreateTableDto) {
    return this.tablesService.create(businessId, dto);
  }

  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER, StaffRole.KITCHEN)
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

  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER, StaffRole.CASHIER, StaffRole.KITCHEN)
  @RequirePermission(BusinessFeature.TABLES, 'read')
  @Get(':id')
  @ApiOperation({ summary: 'Get a table by ID' })
  findOne(@Tenant(true) businessId: string, @Param('id') id: string) {
    return this.tablesService.findOne(businessId, id);
  }

  @Roles(Role.OWNER, StaffRole.MANAGER)
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

  @Roles(Role.OWNER, StaffRole.MANAGER)
  @RequirePermission(BusinessFeature.TABLES, 'update')
  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle table active/inactive status' })
  toggleStatus(
    @Tenant(true) businessId: string,
    @Param('id') id: string,
    @Body() dto: ToggleTableStatusDto,
  ) {
    return this.tablesService.toggleStatus(businessId, id, dto.isActive);
  }

  @Roles(Role.OWNER, StaffRole.MANAGER, StaffRole.WAITER)
  @RequirePermission(BusinessFeature.TABLES, 'read')
  @Patch(':id/reserve')
  @ApiOperation({ summary: 'Manually reserve or unreserve a table' })
  setReservation(
    @Tenant(true) businessId: string,
    @Param('id') id: string,
    @Body() dto: SetTableReservationDto,
  ) {
    return this.tablesService.setReservation(businessId, id, dto.isReserved);
  }

  @Roles(Role.OWNER, StaffRole.MANAGER)
  @RequirePermission(BusinessFeature.TABLES, 'update')
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        cb(null, ALLOWED_MIME_TYPES.test(file.mimetype));
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload image for a table' })
  uploadImage(
    @Tenant(true) businessId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @AuthUser() payload: AuthPayload,
  ) {
    return this.tablesService.uploadImage(businessId, id, file, payload);
  }

  @Roles(Role.OWNER, StaffRole.MANAGER)
  @RequirePermission(BusinessFeature.TABLES, 'delete')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a table' })
  remove(@Tenant(true) businessId: string, @Param('id') id: string) {
    return this.tablesService.remove(businessId, id);
  }
}
