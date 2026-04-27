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
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
@UseGuards(TenantGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new staff member' })
  @ApiResponse({ status: 201, description: 'Staff successfully added' })
  create(@Tenant() businessId: string, @Body() dto: CreateStaffDto) {
    return this.staffService.create(businessId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all staff for the business' })
  findAll(@Tenant() businessId: string) {
    return this.staffService.findAll(businessId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a staff member by ID' })
  findOne(@Tenant() businessId: string, @Param('id') id: string) {
    return this.staffService.findOne(businessId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update staff member details' })
  update(
    @Tenant() businessId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateStaffDto>,
  ) {
    return this.staffService.update(businessId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a staff member' })
  remove(@Tenant() businessId: string, @Param('id') id: string) {
    return this.staffService.remove(businessId, id);
  }
}
