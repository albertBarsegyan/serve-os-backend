import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { FEATURE_PRESETS } from '@common/constants/feature-presets';
import { BusinessType } from '@common/enums/business-type.enum';
import { stringToCommaSeparated } from '@common/utils/string.utils';
import { User } from '@modules/users/entities/user.entity';
import { AuthenticatedUser } from '@common/types/authenticated-request.type';

@Injectable()
export class BusinessService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Create a new business with capability-driven features.
   * If features are not explicitly provided, defaults from FEATURE_PRESETS are used.
   */

  async create(
    createBusinessDto: CreateBusinessDto,
    authUser: AuthenticatedUser,
  ): Promise<Business> {
    return this.dataSource.transaction(async (manager) => {
      const type = createBusinessDto.type ?? BusinessType.RESTAURANT;

      const features = createBusinessDto.features?.length
        ? createBusinessDto.features
        : (FEATURE_PRESETS[type] ?? []);

      const slug = stringToCommaSeparated(createBusinessDto.name);

      const businessRepository = manager.getRepository(Business);
      const userRepository = manager.getRepository(User);

      const business = businessRepository.create({
        ...createBusinessDto,
        slug,
        type,
        features,
        ownerId: authUser.id,
      });

      const savedBusiness = await businessRepository.save(business);

      if (!authUser.hasBusiness)
        await userRepository.update(authUser.id, {
          hasBusiness: true,
        });

      return savedBusiness;
    });
  }

  async findAll(userId: string): Promise<Business[]> {
    return this.businessRepository
      .createQueryBuilder('business')
      .leftJoin('business.staff', 'staff')
      .where('business.ownerId = :userId OR staff.userId = :userId', { userId })
      .groupBy('business.id')
      .getMany();
  }

  async findOne(id: string, userId: string): Promise<Business> {
    const business = await this.businessRepository
      .createQueryBuilder('business')
      .leftJoin('business.staff', 'staff')
      .where('business.id = :id', { id })
      .andWhere('(business.ownerId = :userId OR staff.userId = :userId)', { userId })
      .getOne();

    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }
    return business;
  }

  async update(
    id: string,
    userId: string,
    updateBusinessDto: UpdateBusinessDto,
  ): Promise<Business> {
    const ownedBusiness = await this.businessRepository.findOne({ where: { id, ownerId: userId } });

    if (!ownedBusiness) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    await this.businessRepository.update({ id, ownerId: userId }, updateBusinessDto);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.businessRepository.delete({ id, ownerId: userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }
  }
}
