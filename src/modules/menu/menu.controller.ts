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
import { MenuService } from './menu.service';
import { CreateCategoryDto, CreateProductDto } from './dto/menu.dto';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';

@ApiTags('Menu')
@ApiBearerAuth()
@Controller('menu')
@UseGuards(TenantGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post('categories')
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, description: 'Category successfully created' })
  createCategory(@Tenant() businessId: string, @Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(businessId, dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all categories for the business' })
  findAllCategories(@Tenant() businessId: string) {
    return this.menuService.findAllCategories(businessId);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product successfully created' })
  createProduct(@Tenant() businessId: string, @Body() dto: CreateProductDto) {
    return this.menuService.createProduct(businessId, dto);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get all products for the business' })
  findAllProducts(@Tenant() businessId: string) {
    return this.menuService.findAllProducts(businessId);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update a product' })
  updateProduct(
    @Tenant() businessId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateProductDto>,
  ) {
    return this.menuService.updateProduct(businessId, id, dto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete a product' })
  removeProduct(@Tenant() businessId: string, @Param('id') id: string) {
    return this.menuService.removeProduct(businessId, id);
  }
}
