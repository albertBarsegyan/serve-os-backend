export const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB

/** Set to true to re-encode every upload as WebP. Set to false to preserve the original format. */
export const CONVERT_TO_WEBP = true;

/** Maximum pixels on the longest edge. Images larger than this are downscaled. */
export const MAX_LONG_EDGE = 2000;

/** sharp format strings that we allow as input. */
export const ALLOWED_INPUT_FORMATS = new Set(['jpeg', 'png', 'webp', 'svg']);

/** MIME types accepted at the HTTP layer (before sharp inspection). */
export const ALLOWED_MIME_TYPES = /^image\/(jpeg|png|webp|svg\+xml)$/;
