import {
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModifierSelectionType } from '@common/enums/modifier.enum';
import { CreateModifierItemDto } from './create-modifier.dto';

export class CreateModifierGroupDto {
  @IsString()
  name: string;

  @IsEnum(ModifierSelectionType)
  @IsOptional()
  selectionType?: ModifierSelectionType;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minSelections?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSelections?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  position?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateModifierItemDto)
  @IsOptional()
  modifiers?: CreateModifierItemDto[];
}

export class UpdateModifierGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ModifierSelectionType)
  selectionType?: ModifierSelectionType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minSelections?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSelections?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateModifierItemDto)
  modifiers?: CreateModifierItemDto[];
}
