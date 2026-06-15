import { FileValidator } from '@nestjs/common';

export class FileSizeLimitValidator extends FileValidator<{ maxSize: number }> {
  isValid(file: Express.Multer.File): boolean {
    return file.size <= this.validationOptions.maxSize;
  }

  buildErrorMessage(): string {
    const mb = Math.round(this.validationOptions.maxSize / (1024 * 1024));
    return `File size must not exceed ${mb} MB`;
  }
}

export class ImageTypeValidator extends FileValidator<{ allowedMimeTypes: RegExp }> {
  isValid(file: Express.Multer.File): boolean {
    return this.validationOptions.allowedMimeTypes.test(file.mimetype);
  }

  buildErrorMessage(): string {
    return 'Only SVG, PNG, JPG, JPEG, and WebP files are allowed';
  }
}
