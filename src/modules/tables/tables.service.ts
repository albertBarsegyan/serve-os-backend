import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table } from './entities/table.entity';
import { TableSession } from '@modules/table-sessions/table-session.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { ImagesService } from '@modules/images/images.service';
import { ImageEntityType } from '@src/storage/storage.config';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { v4 as uuidv4 } from 'uuid';

export interface TableWithSession extends Table {
  currentSessionId: string | null;
}

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(TableSession)
    private readonly tableSessionRepository: Repository<TableSession>,
    private readonly imagesService: ImagesService,
  ) {}

  async create(businessId: string, dto: CreateTableDto): Promise<Table> {
    const table = this.tableRepository.create({
      ...dto,
      businessId,
      qrCode: uuidv4(),
    });
    return this.tableRepository.save(table);
  }

  async findAll(businessId: string): Promise<TableWithSession[]> {
    const tables = await this.tableRepository.find({ where: { businessId } });

    const activeSessions = await this.tableSessionRepository.find({
      where: { businessId, isActive: true },
      select: ['id', 'tableId'],
    });

    const sessionByTable = new Map(activeSessions.map((s) => [s.tableId, s.id]));

    return tables.map((t) => ({
      ...t,
      currentSessionId: sessionByTable.get(t.id) ?? null,
    }));
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

  async update(businessId: string, id: string, dto: Partial<CreateTableDto>): Promise<Table> {
    await this.findOne(businessId, id);
    await this.tableRepository.update({ id, businessId }, dto);
    return this.findOne(businessId, id);
  }

  async toggleStatus(businessId: string, id: string, isActive: boolean): Promise<Table> {
    await this.findOne(businessId, id);
    await this.tableRepository.update({ id, businessId }, { isActive });
    return this.findOne(businessId, id);
  }

  async setReservation(businessId: string, id: string, isReserved: boolean): Promise<Table> {
    await this.findOne(businessId, id);
    await this.tableRepository.update({ id, businessId }, { isReserved });
    return this.findOne(businessId, id);
  }

  async uploadImage(
    businessId: string,
    id: string,
    file: Express.Multer.File,
    payload: AuthPayload,
  ): Promise<Table> {
    const table = await this.findOne(businessId, id);

    const uploadedBy = payload.type === 'owner' ? payload.userId : payload.staffId;

    const image = await this.imagesService.upload(file, {
      uploadedBy,
      businessId,
      userId: payload.type === 'owner' ? payload.userId : null,
      staffId: payload.type === 'staff' ? payload.staffId : null,
      entityType: ImageEntityType.BUSINESS_TABLE,
      entityId: id,
    });

    await this.tableRepository.update({ id, businessId }, { imageUrl: image.url });
    table.imageUrl = image.url;
    return table;
  }

  async remove(businessId: string, id: string): Promise<void> {
    const result = await this.tableRepository.softDelete({ id, businessId });
    if (result.affected === 0) {
      throw new NotFoundException(`Table with ID ${id} not found`);
    }
  }
}
