/**
 * Central source of truth for all S3/MinIO storage paths.
 * No raw path strings should appear outside this file.
 *
 * Bucket layout
 * ─────────────
 * public/businesses/{businessId}/logo/{uuid}.webp      ← business logo
 * public/businesses/{businessId}/categories/{uuid}.webp ← menu category covers
 * public/businesses/{businessId}/products/{uuid}.webp   ← product gallery images
 * public/users/{userId}/avatar/{uuid}.webp              ← owner profile avatar
 * public/staff/{staffId}/avatar/{uuid}.webp             ← staff member avatar
 * temp/{uuid}.webp                                      ← pending (24 h lifecycle, no public ACL)
 *
 * Bucket policy
 * ─────────────
 * public/* → s3:GetObject for * (anonymous public read)
 * temp/*   → private (no public policy; lifecycle deletes after 24 h)
 */

export enum ImageEntityType {
  BUSINESS_LOGO = 'logo',
  BUSINESS_CATEGORY = 'category',
  BUSINESS_PRODUCT = 'product',
  BUSINESS_TABLE = 'table',
  USER_AVATAR = 'user-avatar',
  STAFF_AVATAR = 'staff-avatar',
}

export const StoragePaths = {
  /** `public/businesses/{businessId}/logo/{filename}` */
  businessLogo: (businessId: string, filename: string): string =>
    `public/businesses/${businessId}/logo/${filename}`,

  /** `public/businesses/{businessId}/categories/{filename}` */
  businessCategory: (businessId: string, filename: string): string =>
    `public/businesses/${businessId}/categories/${filename}`,

  /** `public/businesses/{businessId}/products/{filename}` */
  businessProduct: (businessId: string, filename: string): string =>
    `public/businesses/${businessId}/products/${filename}`,

  /** `public/businesses/{businessId}/tables/{filename}` */
  businessTable: (businessId: string, filename: string): string =>
    `public/businesses/${businessId}/tables/${filename}`,

  /** `public/users/{userId}/avatar/{filename}` */
  userAvatar: (userId: string, filename: string): string =>
    `public/users/${userId}/avatar/${filename}`,

  /** `public/staff/{staffId}/avatar/{filename}` */
  staffAvatar: (staffId: string, filename: string): string =>
    `public/staff/${staffId}/avatar/${filename}`,

  /**
   * `temp/{filename}` — fallback when entity context is unavailable.
   * MinIO lifecycle rule purges these after 24 hours.
   */
  temp: (filename: string): string => `temp/${filename}`,
} as const;
