import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { StorageService } from '@src/storage/storage.service';
import { ImageEntityType, StoragePaths } from '@src/storage/storage.config';
import { Image } from './entities/image.entity';
import { ALLOWED_INPUT_FORMATS, CONVERT_TO_WEBP, MAX_LONG_EDGE } from './images.constants';

type OutputFormat = 'webp' | 'jpeg' | 'png';

export interface UploadContext {
  /** ID of the user or staff member performing the upload (stored for audit). */
  uploadedBy: string | null;
  /** Owning business — null only for user-avatar uploads. */
  businessId: string | null;
  /** Owner user ID — set when uploader is an owner, null for staff. */
  userId: string | null;
  /** Staff ID of the uploader — set when uploader is staff, null for owners. */
  staffId: string | null;
  /** Determines which storage path template to use. */
  entityType: ImageEntityType | null;
  /**
   * Secondary entity ID. Only meaningful for STAFF_AVATAR when an owner uploads
   * a photo for a specific staff member (entityId = target staffId).
   */
  entityId: string | null;
}

function resolveOutputFormat(sharpFormat: string): OutputFormat {
  if (CONVERT_TO_WEBP) return 'webp';
  if (sharpFormat === 'jpeg') return 'jpeg';
  if (sharpFormat === 'png') return 'png';
  return 'webp';
}

function resolveKey(context: UploadContext, filename: string): string {
  const { entityType, businessId, userId, staffId, entityId } = context;

  switch (entityType) {
    case ImageEntityType.BUSINESS_LOGO:
      if (businessId) return StoragePaths.businessLogo(businessId, filename);
      break;
    case ImageEntityType.BUSINESS_CATEGORY:
      if (businessId) return StoragePaths.businessCategory(businessId, filename);
      break;
    case ImageEntityType.BUSINESS_PRODUCT:
      if (businessId) return StoragePaths.businessProduct(businessId, filename);
      break;
    case ImageEntityType.BUSINESS_TABLE:
      if (businessId) return StoragePaths.businessTable(businessId, filename);
      break;
    case ImageEntityType.USER_AVATAR:
      if (userId) return StoragePaths.userAvatar(userId, filename);
      break;
    case ImageEntityType.STAFF_AVATAR: {
      // Owner uploading for a specific staff member passes entityId = target staffId.
      // A staff member uploading their own avatar passes their own staffId.
      const id = entityId ?? staffId;
      if (id) return StoragePaths.staffAvatar(id, filename);
      break;
    }
  }

  // Fallback: entity context unavailable — write to temp/ (lifecycle: 24 h).
  return StoragePaths.temp(filename);
}

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    private readonly storageService: StorageService,
  ) {}

  async upload(file: Express.Multer.File, context: UploadContext): Promise<Image> {
    // Verify real content type via sharp metadata — do not trust client-declared MIME type.
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(file.buffer).metadata();
    } catch {
      throw new UnprocessableEntityException('File is not a valid image');
    }

    const sharpFormat = metadata.format ?? '';
    if (!ALLOWED_INPUT_FORMATS.has(sharpFormat)) {
      throw new UnprocessableEntityException(
        `Unsupported image format: ${sharpFormat || 'unknown'}`,
      );
    }

    const outputFormat = resolveOutputFormat(sharpFormat);
    const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : `image/${outputFormat}`;
    const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;

    // Re-encode: auto-rotate (apply EXIF orientation), strip all metadata, cap dimensions.
    const pipeline = sharp(file.buffer)
      .rotate()
      .resize(MAX_LONG_EDGE, MAX_LONG_EDGE, { fit: 'inside', withoutEnlargement: true });

    let processedBuffer: Buffer;
    if (outputFormat === 'webp') {
      processedBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
    } else if (outputFormat === 'jpeg') {
      processedBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer();
    } else {
      processedBuffer = await pipeline.png().toBuffer();
    }

    const filename = `${randomUUID()}.${ext}`;
    const key = resolveKey(context, filename);

    const url = await this.storageService.upload(key, processedBuffer, mimeType);

    const image = this.imageRepository.create({
      key,
      url,
      mimeType,
      size: processedBuffer.length,
      uploadedBy: context.uploadedBy,
      businessId: context.businessId,
      entityType: context.entityType,
    });

    return this.imageRepository.save(image);
  }

  async remove(
    id: string,
    caller: { businessId: string | null; uploaderId: string | null },
  ): Promise<void> {
    const image = await this.imageRepository.findOne({ where: { id } });
    if (!image) {
      throw new NotFoundException(`Image ${id} not found`);
    }

    // Business-scoped assets (logos, category/product/table photos) must match the
    // caller's own business. Images with no business (user/staff avatars) fall back to
    // uploader identity, since those aren't tied to any tenant.
    const authorized =
      image.businessId !== null
        ? image.businessId === caller.businessId
        : image.uploadedBy !== null && image.uploadedBy === caller.uploaderId;

    if (!authorized) {
      throw new ForbiddenException('You do not have access to this image');
    }

    // Delete DB row first. If S3 deletion fails, the orphaned object is preferable
    // to a live row pointing at a missing URL.
    await this.imageRepository.remove(image);
    await this.storageService.delete(image.key);
  }
}
