import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUrl } from 'class-validator';

export class ReorderProductImagesDto {
  @ApiProperty({
    type: [String],
    description:
      'All product image URLs in the desired display order. Must contain every existing URL — index 0 becomes the main/cover image.',
  })
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  imageUrls: string[];
}
