import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Tables')
@ApiBearerAuth()
@Controller('tables')
@UseGuards(TenantGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new table' })
  @ApiResponse({ status: 201, description: 'Table successfully created' })
  create(@Tenant() businessId: string, @Body() dto: CreateTableDto) {
    return this.tablesService.create(businessId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tables for the business' })
  findAll(@Tenant() businessId: string) {
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a table by ID' })
  findOne(@Tenant() businessId: string, @Param('id') id: string) {
    return this.tablesService.findOne(businessId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a table' })
  update(
    @Tenant() businessId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateTableDto>,
  ) {
    return this.tablesService.update(businessId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a table' })
  remove(@Tenant() businessId: string, @Param('id') id: string) {
    return this.tablesService.remove(businessId, id);
  }
}
