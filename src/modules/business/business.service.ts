import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { BusinessPaymentMethod } from './entities/business-payment-method.entity';
import { CreateBusinessDto, UpdateBusinessDto, UpsertPaymentMethodDto } from './dto/business.dto';
import { FEATURE_PRESETS } from '@common/constants/feature-presets';
import { BusinessType } from '@common/enums/business-type.enum';
import { stringToCommaSeparated } from '@common/utils/string.utils';
import { User } from '@modules/users/entities/user.entity';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { updateFeatures } from '@common/utils/business-feature.utils';
import { StaffRole } from '@common/enums/staff-role.enum';

@Injectable()
export class BusinessService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(BusinessPaymentMethod)
    private readonly paymentMethodRepository: Repository<BusinessPaymentMethod>,
  ) {}

  /**
   * Create a new business with capability-driven features.
   * If features are not explicitly provided, defaults from FEATURE_PRESETS are used.
   */

  async create(createBusinessDto: CreateBusinessDto, payload: AuthPayload): Promise<Business> {
    if (payload.type !== 'owner') {
      throw new ForbiddenException('Only owners can create businesses');
    }

    return this.dataSource.transaction(async (manager) => {
      const type = createBusinessDto.type ?? BusinessType.RESTAURANT;
      const presetFeatures = FEATURE_PRESETS[type] ?? [];

      const features = createBusinessDto.features?.length
        ? updateFeatures({ features: presetFeatures }, createBusinessDto.features)
        : presetFeatures;

      const slug = stringToCommaSeparated(createBusinessDto.name);

      const businessRepository = manager.getRepository(Business);
      const userRepository = manager.getRepository(User);

      const existingBusiness = await businessRepository.findOne({ where: { slug } });
      if (existingBusiness) {
        throw new ConflictException('A business with this name already exists');
      }

      const business = businessRepository.create({
        ...createBusinessDto,
        slug,
        type,
        features,
        ownerId: payload.userId,
      });

      const savedBusiness = await businessRepository.save(business);

      const owner = await userRepository.findOne({ where: { id: payload.userId } });
      if (owner && !owner.hasBusiness) {
        await userRepository.update(payload.userId, { hasBusiness: true });
      }

      return savedBusiness;
    });
  }

  async findAll(payload: AuthPayload): Promise<Business[]> {
    if (payload.type === 'owner') {
      return this.businessRepository
        .createQueryBuilder('business')
        .where('business.ownerId = :ownerId', { ownerId: payload.userId })
        .getMany();
    }

    return this.businessRepository
      .createQueryBuilder('business')
      .where('business.id = :businessId', { businessId: payload.businessId })
      .getMany();
  }

  async findOne(id: string, payload: AuthPayload): Promise<Business> {
    if (payload.type === 'owner') {
      const business = await this.businessRepository.findOne({
        where: { id, ownerId: payload.userId },
      });

      if (!business) {
        throw new NotFoundException(`Business with ID ${id} not found`);
      }

      return business;
    }

    const business = await this.businessRepository.findOne({ where: { id } });

    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    if (payload.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }

    return business;
  }

  async update(
    id: string,
    payload: AuthPayload,
    updateBusinessDto: UpdateBusinessDto,
  ): Promise<Business> {
    if (payload.type === 'staff') {
      if (payload.role !== StaffRole.MANAGER) {
        throw new ForbiddenException('Insufficient permissions to update business settings');
      }
      if (payload.businessId !== id) {
        throw new ForbiddenException('You do not have access to this business');
      }
    } else if (payload.type !== 'owner') {
      throw new ForbiddenException('Insufficient permissions to update business settings');
    }

    const business = await this.businessRepository.findOne(
      payload.type === 'owner' ? { where: { id, ownerId: payload.userId } } : { where: { id } },
    );

    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    const nextType = updateBusinessDto.type ?? business.type;
    const updatePayload: UpdateBusinessDto = { ...updateBusinessDto };

    if (updateBusinessDto.features) {
      updatePayload.features = updateFeatures(
        {
          features: updateBusinessDto.type ? (FEATURE_PRESETS[nextType] ?? []) : business.features,
        },
        updateBusinessDto.features,
      );
    }

    const whereClause = payload.type === 'owner' ? { id, ownerId: payload.userId } : { id };
    await this.businessRepository.update(whereClause, updatePayload);
    return this.findOne(id, payload);
  }

  async getPaymentMethods(
    businessId: string,
    payload: AuthPayload,
  ): Promise<BusinessPaymentMethod[]> {
    await this.findOne(businessId, payload);
    return this.paymentMethodRepository.find({ where: { businessId } });
  }

  async upsertPaymentMethod(
    businessId: string,
    payload: AuthPayload,
    dto: UpsertPaymentMethodDto,
  ): Promise<BusinessPaymentMethod> {
    if (payload.type !== 'owner') {
      throw new ForbiddenException('Only owners can manage payment methods');
    }
    await this.findOne(businessId, payload);

    const existing = await this.paymentMethodRepository.findOne({
      where: { businessId, method: dto.method },
    });

    if (existing) {
      await this.paymentMethodRepository.update(existing.id, {
        isActive: dto.isActive,
        config: (dto.config ?? existing.config) as never,
      });

      return this.paymentMethodRepository.findOne({
        where: { id: existing.id },
      }) as Promise<BusinessPaymentMethod>;
    }

    const pm = this.paymentMethodRepository.create({
      businessId,
      method: dto.method,
      isActive: dto.isActive,
      config: dto.config ?? null,
    });
    return this.paymentMethodRepository.save(pm);
  }

  async deletePaymentMethod(
    businessId: string,
    methodId: string,
    payload: AuthPayload,
  ): Promise<void> {
    if (payload.type !== 'owner') {
      throw new ForbiddenException('Only owners can manage payment methods');
    }
    await this.findOne(businessId, payload);

    const pm = await this.paymentMethodRepository.findOne({ where: { id: methodId, businessId } });
    if (!pm) throw new NotFoundException('Payment method configuration not found');

    await this.paymentMethodRepository.softDelete(pm.id);
  }

  async remove(id: string, payload: AuthPayload): Promise<void> {
    // Only owners can delete businesses
    if (payload.type !== 'owner') {
      throw new ForbiddenException('Only owners can delete businesses');
    }

    const result = await this.businessRepository.delete({
      id,
      ownerId: payload.userId,
    });

    if (result.affected === 0) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    // Check if user still has businesses
    const remainingBusinesses = await this.businessRepository.count({
      where: {
        ownerId: payload.userId,
      },
    });

    if (remainingBusinesses === 0) {
      await this.userRepository.update({ id: payload.userId }, { hasBusiness: false });
    }
  }
}
