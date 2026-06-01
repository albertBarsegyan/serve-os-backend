import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ModifiersService } from './modifiers.service';
import type { ModifierGroup } from './entities/modifier-group.entity';
import type { Modifier } from './entities/modifier.entity';
import { CreateModifierGroupDto, UpdateModifierGroupDto } from './dto/modifier-group.dto';
import { CreateModifierItemDto } from './dto/create-modifier.dto';
import { UnifiedAuthGuard } from '@modules/auth/guards/unified-auth.guard';
import { GetAuthPayload } from '@modules/auth/decorators/auth-payload.decorator';
import type { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { TenantGuard } from '@common/guards/tenant.guard';

@Controller('businesses/:businessId/modifier-groups')
@UseGuards(UnifiedAuthGuard, TenantGuard)
export class ModifiersController {
  constructor(private modifiersService: ModifiersService) {}

  /**
   * POST /businesses/:businessId/modifier-groups
   * Create a new modifier group with modifiers
   */
  @Post()
  async createModifierGroup(
    @Param('businessId') businessId: string,
    @Body() dto: CreateModifierGroupDto,
    @GetAuthPayload() payload: AuthPayload,
  ): Promise<ModifierGroup> {
    return this.modifiersService.createModifierGroup(businessId, dto);
  }

  /**
   * GET /businesses/:businessId/modifier-groups
   * Get all modifier groups for a business
   */
  @Get()
  async getModifierGroups(
    @Param('businessId') businessId: string,
    @GetAuthPayload() payload: AuthPayload,
  ): Promise<ModifierGroup[]> {
    return this.modifiersService.getModifierGroups(businessId);
  }

  /**
   * GET /businesses/:businessId/modifier-groups/:groupId
   * Get a specific modifier group
   */
  @Get(':groupId')
  async getModifierGroup(
    @Param('businessId') businessId: string,
    @Param('groupId') groupId: string,
    @GetAuthPayload() payload: AuthPayload,
  ): Promise<ModifierGroup> {
    return this.modifiersService.getModifierGroup(businessId, groupId);
  }

  /**
   * PUT /businesses/:businessId/modifier-groups/:groupId
   * Update a modifier group
   */
  @Put(':groupId')
  async updateModifierGroup(
    @Param('businessId') businessId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateModifierGroupDto,
    @GetAuthPayload() payload: AuthPayload,
  ): Promise<ModifierGroup> {
    return this.modifiersService.updateModifierGroup(businessId, groupId, dto);
  }

  /**
   * DELETE /businesses/:businessId/modifier-groups/:groupId
   * Delete a modifier group (soft delete)
   */
  @Delete(':groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteModifierGroup(
    @Param('businessId') businessId: string,
    @Param('groupId') groupId: string,
    @GetAuthPayload() payload: AuthPayload,
  ): Promise<void> {
    return this.modifiersService.deleteModifierGroup(businessId, groupId);
  }

  // ── Modifier Item Routes ──────────────────────────────────────────────────────────

  /**
   * POST /businesses/:businessId/modifier-groups/:groupId/modifiers
   * Add a modifier to a group
   */
  @Post(':groupId/modifiers')
  async addModifierToGroup(
    @Param('businessId') businessId: string,
    @Param('groupId') groupId: string,
    @Body() dto: CreateModifierItemDto,
    @GetAuthPayload() payload: AuthPayload,
  ): Promise<Modifier> {
    return this.modifiersService.addModifierToGroup(businessId, groupId, dto);
  }

  /**
   * GET /businesses/:businessId/modifier-groups/:groupId/modifiers
   * Get all modifiers in a group
   */
  @Get(':groupId/modifiers')
  async getModifiers(
    @Param('businessId') businessId: string,
    @Param('groupId') groupId: string,
    @GetAuthPayload() payload: AuthPayload,
  ): Promise<Modifier[]> {
    return this.modifiersService.getModifiers(businessId, groupId);
  }

  /**
   * PUT /businesses/:businessId/modifier-groups/:groupId/modifiers/:modifierId
   * Update a modifier
   */
  @Put(':groupId/modifiers/:modifierId')
  async updateModifier(
    @Param('businessId') businessId: string,
    @Param('groupId') groupId: string,
    @Param('modifierId') modifierId: string,
    @Body() dto: Partial<CreateModifierItemDto>,
    @GetAuthPayload() payload: AuthPayload,
  ): Promise<Modifier> {
    return this.modifiersService.updateModifier(businessId, groupId, modifierId, dto);
  }

  /**
   * DELETE /businesses/:businessId/modifier-groups/:groupId/modifiers/:modifierId
   * Delete a modifier
   */
  @Delete(':groupId/modifiers/:modifierId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteModifier(
    @Param('businessId') businessId: string,
    @Param('groupId') groupId: string,
    @Param('modifierId') modifierId: string,
    @GetAuthPayload() payload: AuthPayload,
  ): Promise<void> {
    return this.modifiersService.deleteModifier(businessId, groupId, modifierId);
  }
}
