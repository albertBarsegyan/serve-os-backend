import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from './entities/staff.entity';
import { CreateStaffDto } from './dto/create-staff.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
  ) {}

  async create(businessId: string, dto: CreateStaffDto): Promise<Staff> {
    const staff = this.staffRepository.create({ ...dto, businessId });
    return this.staffRepository.save(staff);
  }

  async findAll(businessId: string): Promise<Staff[]> {
    return this.staffRepository.find({
      where: { businessId },
      relations: ['user'],
    });
  }

  async findOne(businessId: string, id: string): Promise<Staff> {
    const staff = await this.staffRepository.findOne({
      where: { id, businessId },
      relations: ['user'],
    });
    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }
    return staff;
  }

  async update(
    businessId: string,
    id: string,
    dto: Partial<CreateStaffDto>,
  ): Promise<Staff> {
    await this.findOne(businessId, id);
    await this.staffRepository.update(id, dto);
    return this.findOne(businessId, id);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const result = await this.staffRepository.delete({ id, businessId });
    if (result.affected === 0) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }
  }
}
