import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
  ) {}

  async create(createBusinessDto: CreateBusinessDto): Promise<Business> {
    const business = this.businessRepository.create(createBusinessDto);
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

  async update(
    id: string,
    updateBusinessDto: UpdateBusinessDto,
  ): Promise<Business> {
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
