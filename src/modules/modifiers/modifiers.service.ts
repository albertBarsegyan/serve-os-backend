import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { ModifierGroup } from './entities/modifier-group.entity';
import { Modifier } from './entities/modifier.entity';
import { CreateModifierGroupDto, UpdateModifierGroupDto } from './dto/modifier-group.dto';
import { CreateModifierItemDto } from './dto/create-modifier.dto';
import { ModifierSelectionType } from '@common/enums/modifier.enum';

@Injectable()
export class ModifiersService {
  constructor(
    @InjectRepository(ModifierGroup)
    private readonly modifierGroupRepository: Repository<ModifierGroup>,
    @InjectRepository(Modifier)
    private readonly modifierRepository: Repository<Modifier>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a modifier group with its modifiers in a transaction
   */
  async createModifierGroup(
    businessId: string,
    dto: CreateModifierGroupDto,
  ): Promise<ModifierGroup> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create the modifier group
      const modifierGroup = this.modifierGroupRepository.create({
        businessId,
        name: dto.name,
        selectionType: dto.selectionType || ModifierSelectionType.SINGLE,
        isRequired: dto.isRequired ?? false,
        minSelections: dto.minSelections ?? 1,
        maxSelections: dto.maxSelections,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      });

      const savedGroup = await queryRunner.manager.save(modifierGroup);

      // Create modifiers if provided
      if (dto.modifiers && dto.modifiers.length > 0) {
        const modifiers = dto.modifiers.map((modifierDto, index) =>
          this.modifierRepository.create({
            groupId: savedGroup.id,
            name: modifierDto.name,
            priceAdjustment: modifierDto.priceAdjustment,
            position: modifierDto.position ?? index,
            isActive: true,
          }),
        );

        await queryRunner.manager.save(modifiers);
        savedGroup.modifiers = modifiers;
      } else {
        savedGroup.modifiers = [];
      }

      await queryRunner.commitTransaction();
      return savedGroup;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get all modifier groups for a business
   */
  async getModifierGroups(businessId: string): Promise<ModifierGroup[]> {
    return this.modifierGroupRepository.find({
      where: { businessId, deletedAt: IsNull() },
      relations: ['modifiers'],
      order: { position: 'ASC', modifiers: { position: 'ASC' } },
    });
  }

  /**
   * Get a single modifier group by ID
   */
  async getModifierGroup(businessId: string, groupId: string): Promise<ModifierGroup> {
    const group = await this.modifierGroupRepository.findOne({
      where: { id: groupId, businessId, deletedAt: IsNull() },
      relations: ['modifiers'],
    });

    if (!group) {
      throw new NotFoundException(`Modifier group ${groupId} not found`);
    }

    return group;
  }

  /**
   * Update a modifier group (partial update)
   * If modifiers are provided, replace all existing modifiers
   */
  async updateModifierGroup(
    businessId: string,
    groupId: string,
    dto: UpdateModifierGroupDto,
  ): Promise<ModifierGroup> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const group = await queryRunner.manager.findOne(ModifierGroup, {
        where: { id: groupId, businessId, deletedAt: IsNull() },
      });

      if (!group) {
        throw new NotFoundException(`Modifier group ${groupId} not found`);
      }

      // Update group fields
      if (dto.name !== undefined) group.name = dto.name;
      if (dto.selectionType !== undefined) group.selectionType = dto.selectionType;
      if (dto.isRequired !== undefined) group.isRequired = dto.isRequired;
      if (dto.minSelections !== undefined) group.minSelections = dto.minSelections;
      if (dto.maxSelections !== undefined) group.maxSelections = dto.maxSelections;
      if (dto.position !== undefined) group.position = dto.position;
      if (dto.isActive !== undefined) group.isActive = dto.isActive;

      const updatedGroup = await queryRunner.manager.save(group);

      // If modifiers are provided, replace them
      if (dto.modifiers !== undefined) {
        // Delete existing modifiers
        await queryRunner.manager.delete(Modifier, { groupId });

        // Create new modifiers
        if (dto.modifiers.length > 0) {
          const modifiers = dto.modifiers.map((modifierDto, index) =>
            this.modifierRepository.create({
              groupId: updatedGroup.id,
              name: modifierDto.name,
              priceAdjustment: modifierDto.priceAdjustment,
              position: modifierDto.position ?? index,
              isActive: true,
            }),
          );

          await queryRunner.manager.save(modifiers);
          updatedGroup.modifiers = modifiers;
        } else {
          updatedGroup.modifiers = [];
        }
      } else {
        // Load existing modifiers if not replacing them
        updatedGroup.modifiers = await queryRunner.manager.find(Modifier, {
          where: { groupId },
          order: { position: 'ASC' },
        });
      }

      await queryRunner.commitTransaction();
      return updatedGroup;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Delete a modifier group (soft delete)
   */
  async deleteModifierGroup(businessId: string, groupId: string): Promise<void> {
    const result = await this.modifierGroupRepository.update(
      { id: groupId, businessId },
      { deletedAt: new Date() },
    );

    if (result.affected === 0) {
      throw new NotFoundException(`Modifier group ${groupId} not found`);
    }
  }

  /**
   * Add a single modifier to a group
   */
  async addModifierToGroup(
    businessId: string,
    groupId: string,
    dto: CreateModifierItemDto,
  ): Promise<Modifier> {
    // Verify the group exists and belongs to the business
    const group = await this.modifierGroupRepository.findOne({
      where: { id: groupId, businessId, deletedAt: IsNull() },
    });

    if (!group) {
      throw new NotFoundException(`Modifier group ${groupId} not found`);
    }

    // Get the next position
    const maxPosition = await this.modifierRepository
      .createQueryBuilder('m')
      .where('m.groupId = :groupId', { groupId })
      .orderBy('m.position', 'DESC')
      .getOne();

    const nextPosition = (maxPosition?.position ?? 0) + 1;

    const modifier = this.modifierRepository.create({
      groupId,
      name: dto.name,
      priceAdjustment: dto.priceAdjustment,
      position: dto.position ?? nextPosition,
      isActive: true,
    });

    return this.modifierRepository.save(modifier);
  }

  /**
   * Update a single modifier
   */
  async updateModifier(
    businessId: string,
    groupId: string,
    modifierId: string,
    dto: Partial<CreateModifierItemDto>,
  ): Promise<Modifier> {
    // Verify the group exists and belongs to the business
    const group = await this.modifierGroupRepository.findOne({
      where: { id: groupId, businessId, deletedAt: IsNull() },
    });

    if (!group) {
      throw new NotFoundException(`Modifier group ${groupId} not found`);
    }

    const modifier = await this.modifierRepository.findOne({
      where: { id: modifierId, groupId },
    });

    if (!modifier) {
      throw new NotFoundException(`Modifier ${modifierId} not found in group ${groupId}`);
    }

    if (dto.name !== undefined) modifier.name = dto.name;
    if (dto.priceAdjustment !== undefined) modifier.priceAdjustment = dto.priceAdjustment;
    if (dto.position !== undefined) modifier.position = dto.position;

    return this.modifierRepository.save(modifier);
  }

  /**
   * Delete a single modifier
   */
  async deleteModifier(businessId: string, groupId: string, modifierId: string): Promise<void> {
    // Verify the group exists and belongs to the business
    const group = await this.modifierGroupRepository.findOne({
      where: { id: groupId, businessId, deletedAt: IsNull() },
    });

    if (!group) {
      throw new NotFoundException(`Modifier group ${groupId} not found`);
    }

    const result = await this.modifierRepository.delete({ id: modifierId, groupId });

    if (result.affected === 0) {
      throw new NotFoundException(`Modifier ${modifierId} not found in group ${groupId}`);
    }
  }

  /**
   * Get modifiers for a group
   */
  async getModifiers(businessId: string, groupId: string): Promise<Modifier[]> {
    // Verify the group exists and belongs to the business
    const group = await this.modifierGroupRepository.findOne({
      where: { id: groupId, businessId, deletedAt: IsNull() },
    });

    if (!group) {
      throw new NotFoundException(`Modifier group ${groupId} not found`);
    }

    return this.modifierRepository.find({
      where: { groupId },
      order: { position: 'ASC' },
    });
  }
}
