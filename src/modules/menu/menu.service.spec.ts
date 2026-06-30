import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { MenuService } from './menu.service';
import { MenuCategory } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ModifierGroup } from '@modules/modifiers/entities/modifier-group.entity';

function makeProduct(imageUrls: string[]): Product {
  return {
    id: 'prod-1',
    businessId: 'biz-1',
    imageUrls,
    imageUrl: imageUrls[0] ?? null,
  } as Product;
}

const categoryRepoMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  softDelete: jest.fn(),
});

const modifierGroupRepoMock = () => ({
  find: jest.fn(),
});

describe('MenuService.reorderProductImages', () => {
  let service: MenuService;
  let productRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
  };

  beforeEach(async () => {
    productRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: getRepositoryToken(MenuCategory), useFactory: categoryRepoMock },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(ModifierGroup), useFactory: modifierGroupRepoMock },
      ],
    }).compile();

    service = module.get<MenuService>(MenuService);
  });

  it('persists the new image order and sets imageUrl to the first item', async () => {
    const product = makeProduct(['a.webp', 'b.webp', 'c.webp']);
    productRepo.findOne.mockResolvedValue(product);

    await service.reorderProductImages('biz-1', 'prod-1', ['c.webp', 'a.webp', 'b.webp']);

    expect(productRepo.update).toHaveBeenCalledWith(
      { id: 'prod-1', businessId: 'biz-1' },
      expect.objectContaining({
        imageUrls: ['c.webp', 'a.webp', 'b.webp'],
        imageUrl: 'c.webp',
      }),
    );
  });

  it('throws BadRequestException when a URL is not in the product', async () => {
    const product = makeProduct(['a.webp', 'b.webp']);
    productRepo.findOne.mockResolvedValue(product);

    await expect(
      service.reorderProductImages('biz-1', 'prod-1', ['a.webp', 'intruder.webp']),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when imageUrls count does not match', async () => {
    const product = makeProduct(['a.webp', 'b.webp']);
    productRepo.findOne.mockResolvedValue(product);

    await expect(service.reorderProductImages('biz-1', 'prod-1', ['a.webp'])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFoundException for a product outside the business scope', async () => {
    productRepo.findOne.mockResolvedValue(null);

    await expect(service.reorderProductImages('other-biz', 'prod-1', ['a.webp'])).rejects.toThrow(
      NotFoundException,
    );
  });
});
