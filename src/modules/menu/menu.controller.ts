import { Controller, Get, Post, Put, Body, Patch, Param, Delete, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { CreateCategoryDto, UpdateCategoryDto, CreateProductDto, SyncModifierGroupsDto } from './dto/menu.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { Public } from '@common/decorators/public.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';

@ApiTags('Menu')
@ApiBearerAuth()
@Controller('menu')
@UseGuards(TenantGuard)
@Roles(Role.OWNER, StaffRole.MANAGER)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Public()
  @AllowWithoutBusiness()
  @Get('customer')
  @ApiOperation({ summary: 'Get public menu for customer QR flow' })
  getCustomerMenu(@Query('businessId', ParseUUIDPipe) businessId: string) {
    return this.menuService.findPublicMenu(businessId);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, description: 'Category successfully created' })
  createCategory(@Tenant(true) businessId: string, @Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(businessId, dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all categories for the business' })
  findAllCategories(@Tenant(true) businessId: string) {
    return this.menuService.findAllCategories(businessId);
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get a single category' })
  findCategory(@Tenant(true) businessId: string, @Param('id') id: string) {
    return this.menuService.findCategory(businessId, id);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category' })
  updateCategory(
    @Tenant(true) businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.menuService.updateCategory(businessId, id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category' })
  removeCategory(@Tenant(true) businessId: string, @Param('id') id: string) {
    return this.menuService.removeCategory(businessId, id);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product successfully created' })
  createProduct(@Tenant(true) businessId: string, @Body() dto: CreateProductDto) {
    return this.menuService.createProduct(businessId, dto);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get all products for the business' })
  findAllProducts(@Tenant(true) businessId: string) {
    return this.menuService.findAllProducts(businessId);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a single product' })
  findProduct(@Tenant(true) businessId: string, @Param('id') id: string) {
    return this.menuService.findProduct(businessId, id);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update a product' })
  updateProduct(
    @Tenant(true) businessId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateProductDto>,
  ) {
    return this.menuService.updateProduct(businessId, id, dto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete a product' })
  removeProduct(@Tenant(true) businessId: string, @Param('id') id: string) {
    return this.menuService.removeProduct(businessId, id);
  }

  @Put('products/:id/modifier-groups')
  @ApiOperation({ summary: 'Sync modifier groups attached to a product' })
  syncProductModifierGroups(
    @Tenant(true) businessId: string,
    @Param('id') id: string,
    @Body() dto: SyncModifierGroupsDto,
  ) {
    return this.menuService.syncModifierGroups(businessId, id, dto.groupIds);
  }
}
