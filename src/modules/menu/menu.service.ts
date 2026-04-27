import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { CreateCategoryDto, CreateProductDto } from './dto/menu.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  // Category CRUD
  async createCategory(
    businessId: string,
    dto: CreateCategoryDto,
  ): Promise<Category> {
    const category = this.categoryRepository.create({ ...dto, businessId });
    return this.categoryRepository.save(category);
  }

  async findAllCategories(businessId: string): Promise<Category[]> {
    return this.categoryRepository.find({
      where: { businessId },
      order: { sortOrder: 'ASC' },
      relations: ['products'],
    });
  }

  async findCategory(businessId: string, id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id, businessId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  // Product CRUD
  async createProduct(
    businessId: string,
    dto: CreateProductDto,
  ): Promise<Product> {
    const category = await this.findCategory(businessId, dto.categoryId);
    const product = this.productRepository.create({ ...dto, businessId });
    return this.productRepository.save(product);
  }

  async findAllProducts(businessId: string): Promise<Product[]> {
    return this.productRepository.find({
      where: { businessId },
      relations: ['category'],
    });
  }

  async findProduct(businessId: string, id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, businessId },
      relations: ['category'],
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async updateProduct(
    businessId: string,
    id: string,
    dto: Partial<CreateProductDto>,
  ): Promise<Product> {
    const product = await this.findProduct(businessId, id);
    if (dto.categoryId) {
      await this.findCategory(businessId, dto.categoryId);
    }
    await this.productRepository.update(id, dto);
    return this.findProduct(businessId, id);
  }

  async removeProduct(businessId: string, id: string): Promise<void> {
    const result = await this.productRepository.delete({ id, businessId });
    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }
}
