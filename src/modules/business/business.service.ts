import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { FEATURE_PRESETS } from '@common/constants/feature-presets';
import { BusinessType } from '@common/enums/business-type.enum';
import { stringToCommaSeparated } from '@common/utils/string.utils';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  /**
   * Create a new business with capability-driven features.
   * If features are not explicitly provided, defaults from FEATURE_PRESETS are used.
   */
  async create(createBusinessDto: CreateBusinessDto): Promise<Business> {
    const type = createBusinessDto.type ?? BusinessType.RESTAURANT;

    // Use provided features, or fallback to preset for the business type
    const features =
      createBusinessDto.features && createBusinessDto.features?.length > 0
        ? createBusinessDto.features
        : (FEATURE_PRESETS[type] ?? []);

    const slug = stringToCommaSeparated(createBusinessDto.name);

    const business = this.businessRepository.create({
      ...createBusinessDto,
      slug,
      type,
      features,
      ownerId: '',
    });
    return this.businessRepository.save(business);
  }

  async findAll(): Promise<Business[]> {
    return this.businessRepository.find();
  }

  async findOne(id: string): Promise<Business> {
    const business = await this.businessRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }
    return business;
  }

  async update(id: string, updateBusinessDto: UpdateBusinessDto): Promise<Business> {
    await this.findOne(id);
    await this.businessRepository.update(id, updateBusinessDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.businessRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }
  }
}
