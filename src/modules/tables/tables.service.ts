import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table } from './entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
  ) {}

  async create(businessId: string, dto: CreateTableDto): Promise<Table> {
    const table = this.tableRepository.create({
      ...dto,
      businessId,
      qrCode: uuidv4(),
    });
    return this.tableRepository.save(table);
  }

  async findAll(businessId: string): Promise<Table[]> {
    return this.tableRepository.find({ where: { businessId } });
  }

  async findOne(businessId: string, id: string): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id, businessId },
    });
    if (!table) {
      throw new NotFoundException(`Table with ID ${id} not found`);
    }
    return table;
  }

  async findByQrCode(qrCode: string): Promise<Table> {
    const table = await this.tableRepository.findOne({ where: { qrCode } });
    if (!table) {
      throw new NotFoundException(`Table with QR code ${qrCode} not found`);
    }
    return table;
  }

  async update(
    businessId: string,
    id: string,
    dto: Partial<CreateTableDto>,
  ): Promise<Table> {
    const table = await this.findOne(businessId, id);
    await this.tableRepository.update(id, dto);
    return this.findOne(businessId, id);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const result = await this.tableRepository.delete({ id, businessId });
    if (result.affected === 0) {
      throw new NotFoundException(`Table with ID ${id} not found`);
    }
  }
}
