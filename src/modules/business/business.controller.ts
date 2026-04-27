import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Business')
@ApiBearerAuth()
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a new business' })
  @ApiResponse({ status: 201, description: 'Business successfully created' })
  create(@Body() createBusinessDto: CreateBusinessDto) {
    return this.businessService.create(createBusinessDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all businesses' })
  findAll() {
    return this.businessService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a business by ID' })
  @ApiResponse({ status: 200, description: 'Business found' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  findOne(@Param('id') id: string) {
    return this.businessService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a business' })
  update(
    @Param('id') id: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
  ) {
    return this.businessService.update(id, updateBusinessDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a business' })
  remove(@Param('id') id: string) {
    return this.businessService.remove(id);
  }
}
