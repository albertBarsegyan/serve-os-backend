import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ImageEntityType } from '@src/storage/storage.config';

export class UploadImageDto {
  @ApiPropertyOptional({
    enum: ImageEntityType,
    description: 'Where this image will be used — determines the storage path.',
  })
  @IsOptional()
  @IsEnum(ImageEntityType)
  entityType?: ImageEntityType;

  /**
   * Entity ID required for STAFF_AVATAR when the uploader is an owner uploading
   * on behalf of a specific staff member. Ignored for other entity types.
   */
  @ApiPropertyOptional({ description: 'Staff ID (required only for staff-avatar uploads).' })
  @IsOptional()
  @IsUUID()
  entityId?: string;
}
