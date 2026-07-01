import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MenuCategory } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ModifierGroup } from '@modules/modifiers/entities/modifier-group.entity';
import { CreateCategoryDto, CreateProductDto, UpdateCategoryDto } from './dto/menu.dto';
import slugify from 'slugify';
import { Business } from '@modules/business/entities/business.entity';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuCategory)
    private readonly categoryRepository: Repository<MenuCategory>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ModifierGroup)
    private readonly modifierGroupRepository: Repository<ModifierGroup>,
  ) {}

  async createCategory(businessId: string, dto: CreateCategoryDto): Promise<MenuCategory> {
    const category = this.categoryRepository.create({ ...dto, businessId });
    return this.categoryRepository.save(category);
  }

  async findAllCategories(businessId: string): Promise<MenuCategory[]> {
    return this.categoryRepository.find({
      where: { businessId },
      order: { sortOrder: 'ASC' },
      relations: ['products', 'products.kitchenStation'],
    });
  }

  async findCategory(businessId: string, id: string): Promise<MenuCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id, businessId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async updateCategory(
    businessId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<MenuCategory> {
    const category = await this.findCategory(businessId, id);
    Object.assign(category, dto);
    return this.categoryRepository.save(category);
  }

  async removeCategory(businessId: string, id: string): Promise<void> {
    const category = await this.findCategory(businessId, id);
    await this.categoryRepository.softDelete(category.id);
  }

  async createProduct(businessId: string, dto: CreateProductDto): Promise<Product> {
    const category = await this.findCategory(businessId, dto.categoryId);
    // Prepare slug: if not provided, generate from name and ensure uniqueness scoped to businessId
    let slug = dto.slug?.trim();
    if (!slug) {
      const base = slugify(dto.name, { lower: true, strict: true });
      let candidate = base;
      let idx = 2;
      // check uniqueness scoped to businessId

      while (true) {
        const exists = await this.productRepository.findOne({
          where: { businessId, slug: candidate },
        });
        if (!exists) {
          slug = candidate;
          break;
        }
        candidate = `${base}-${idx++}`;
      }
    }

    // Build explicit partial Product to avoid accidental mapping of DTO-only fields
    const productData: Partial<Product> = {
      businessId,
      categoryId: dto.categoryId,
      name: dto.name,
      description: dto.description ?? undefined,
      price: dto.basePrice,
      compareAtPrice: dto.compareAtPrice ?? null,
      slug,
      sku: dto.sku ?? null,
      prepTimeMinutes: dto.prepTimeMinutes ?? undefined,
      availablePeriod: dto.availablePeriod ?? undefined,
      sortOrder: dto.sortOrder ?? undefined,
      isAvailable: dto.isAvailable ?? undefined,
      isFeatured: dto.isFeatured ?? undefined,
      dietaryFlags: dto.dietaryFlags ? dto.dietaryFlags.map(String) : undefined,
      allergens: dto.allergens ? dto.allergens.map(String) : undefined,
      imageUrls: dto.imageUrls ?? undefined,
      imageUrl: dto.imageUrls?.[0] ?? undefined,
      kitchenStationId: category.kitchenStationId ?? null,
    };

    const product = this.productRepository.create(productData);
    return this.productRepository.save(product);
  }

  async findAllProducts(
    businessId: string,
    pagination: { page: number; limit: number },
    filters?: { categoryId?: string; availableOnly?: boolean },
  ): Promise<import('@common/types/paginated-response.type').PaginatedResponse<Product>> {
    const { page, limit } = pagination;
    const where: Record<string, unknown> = { businessId };
    if (filters?.categoryId) where['categoryId'] = filters.categoryId;
    if (filters?.availableOnly) where['isAvailable'] = true;
    const [data, total] = await this.productRepository.findAndCount({
      where,
      relations: ['category', 'kitchenStation'],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findProduct(businessId: string, id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, businessId },
      relations: ['category', 'kitchenStation', 'modifierGroups', 'modifierGroups.modifiers'],
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
    await this.findProduct(businessId, id);
    const updateData: Partial<Product> = {};

    // Only copy allowed fields from DTO to updateData to avoid DTO-specific properties
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if ((dto as CreateProductDto).basePrice !== undefined)
      updateData.price = (dto as CreateProductDto).basePrice;
    if ((dto as CreateProductDto).compareAtPrice !== undefined)
      updateData.compareAtPrice = (dto as CreateProductDto).compareAtPrice ?? null;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.sku !== undefined) updateData.sku = dto.sku ?? null;
    if (dto.prepTimeMinutes !== undefined) updateData.prepTimeMinutes = dto.prepTimeMinutes;
    if (dto.availablePeriod !== undefined) updateData.availablePeriod = dto.availablePeriod;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.isAvailable !== undefined) updateData.isAvailable = dto.isAvailable;
    if (dto.isFeatured !== undefined) updateData.isFeatured = dto.isFeatured;
    if (dto.dietaryFlags !== undefined) updateData.dietaryFlags = dto.dietaryFlags.map(String);
    if (dto.allergens !== undefined) updateData.allergens = dto.allergens.map(String);
    if (dto.imageUrls !== undefined) {
      updateData.imageUrls = dto.imageUrls;
      updateData.imageUrl = dto.imageUrls[0] ?? null;
    }

    if (dto.categoryId) {
      const category = await this.findCategory(businessId, dto.categoryId);
      updateData.categoryId = dto.categoryId;
      updateData.kitchenStationId = category.kitchenStationId ?? null;
    }

    await this.productRepository.update({ id, businessId }, updateData as Business);
    return this.findProduct(businessId, id);
  }

  async updateProductAvailability(
    businessId: string,
    id: string,
    isAvailable: boolean,
  ): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id, businessId } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    await this.productRepository.update({ id, businessId }, { isAvailable });
    return this.findProduct(businessId, id);
  }

  async removeProduct(businessId: string, id: string): Promise<void> {
    const result = await this.productRepository.softDelete({ id, businessId });
    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }

  async findPublicMenu(businessId: string) {
    return this.categoryRepository
      .createQueryBuilder('cat')
      .leftJoinAndSelect(
        'cat.products',
        'product',
        'product.isAvailable = true AND product.deletedAt IS NULL',
      )
      .leftJoinAndSelect(
        'product.modifierGroups',
        'grp',
        'grp.isActive = true AND grp.deletedAt IS NULL',
      )
      .leftJoinAndSelect('grp.modifiers', 'mod', 'mod.isActive = true')
      .where('cat.businessId = :businessId AND cat.deletedAt IS NULL', { businessId })
      .orderBy('cat.sortOrder', 'ASC')
      .addOrderBy('product.sortOrder', 'ASC')
      .addOrderBy('grp.position', 'ASC')
      .addOrderBy('mod.position', 'ASC')
      .getMany();
  }

  async reorderProductImages(
    businessId: string,
    productId: string,
    imageUrls: string[],
  ): Promise<Product> {
    const product = await this.findProduct(businessId, productId);

    if (imageUrls.length !== product.imageUrls.length) {
      throw new BadRequestException(
        'imageUrls must contain all existing product image URLs — no additions or omissions allowed',
      );
    }

    const current = new Set(product.imageUrls);
    for (const url of imageUrls) {
      if (!current.has(url)) {
        throw new BadRequestException(`Image URL does not belong to this product: ${url}`);
      }
    }

    await this.productRepository.update(
      { id: productId, businessId },
      {
        imageUrls,
        imageUrl: imageUrls[0] ?? null,
      },
    );
    return this.findProduct(businessId, productId);
  }

  async syncModifierGroups(
    businessId: string,
    productId: string,
    groupIds: string[],
  ): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId, businessId },
      relations: ['modifierGroups'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const groups =
      groupIds.length > 0
        ? await this.modifierGroupRepository.find({
            where: { businessId, id: In(groupIds) },
          })
        : [];

    product.modifierGroups = groups;
    await this.productRepository.save(product);

    return this.findProduct(businessId, productId);
  }
}
