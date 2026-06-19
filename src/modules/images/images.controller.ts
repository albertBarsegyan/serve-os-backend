import {
  Controller,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Body,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ImagesService } from './images.service';
import { UploadImageDto } from './dto/upload-image.dto';
import type { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import { Roles } from '@common/decorators/roles.decorator';
import { AllowWithoutBusiness } from '@common/decorators/allow-without-business.decorator';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './images.constants';
import { FileSizeLimitValidator, ImageTypeValidator } from './images.validators';
import { ImageEntityType } from '@src/storage/storage.config';

@ApiTags('Images')
@ApiBearerAuth()
@Controller('images')
@Roles(Role.OWNER, StaffRole.MANAGER)
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('upload')
  @AllowWithoutBusiness()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload an image (svg, png, jpg, jpeg, webp — max 3 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        entityType: { type: 'string', enum: Object.values(ImageEntityType) },
        entityId: { type: 'string', format: 'uuid' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded and metadata saved' })
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileSizeLimitValidator({ maxSize: MAX_FILE_SIZE }),
          new ImageTypeValidator({ allowedMimeTypes: ALLOWED_MIME_TYPES }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadImageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const payload = req.user;

    let businessId: string | null = req.businessId ?? null;
    let userId: string | null = null;
    let staffId: string | null = null;
    let uploadedBy: string | null = null;

    if (payload?.type === 'owner') {
      userId = payload.userId;
      uploadedBy = payload.userId;
      // businessId already populated by TenantMiddleware from the business_id cookie
    } else if (payload?.type === 'staff') {
      staffId = payload.staffId;
      businessId = payload.businessId;
      uploadedBy = payload.staffId;
    }

    return this.imagesService.upload(file, {
      uploadedBy,
      businessId,
      userId,
      staffId,
      entityType: dto.entityType ?? null,
      entityId: dto.entityId ?? null,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an image (removes DB row and S3 object)' })
  @ApiResponse({ status: 204, description: 'Image deleted' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.imagesService.remove(id);
  }
}
