/**
 * Standardized error codes for API responses
 * Frontend can use these codes to provide specific error handling and messaging
 *
 * Usage:
 * - 400 Bad Request: VALIDATION_ERROR, INVALID_REQUEST
 * - 401 Unauthorized: USER_NOT_FOUND, INVALID_CREDENTIALS, INVALID_TOKEN, INVALID_REFRESH_TOKEN, STAFF_INACTIVE
 * - 403 Forbidden: USER_INACTIVE, STAFF_NOT_FOUND, UNAUTHORIZED, INVALID_PASSWORD, INVALID_PIN
 * - 404 Not Found: NOT_FOUND
 * - 409 Conflict: CONFLICT
 * - 500 Internal Server Error: INTERNAL_ERROR
 */
export enum ApiErrorCode {
  // Authentication / User errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_INACTIVE = 'USER_INACTIVE',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INVALID_PIN = 'INVALID_PIN',

  // Staff errors
  STAFF_NOT_FOUND = 'STAFF_NOT_FOUND',
  STAFF_INACTIVE = 'STAFF_INACTIVE',
  INVALID_STAFF_AUTH_METHOD = 'INVALID_STAFF_AUTH_METHOD',

  // Token errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',

  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  OWNER_ACCESS_REQUIRED = 'OWNER_ACCESS_REQUIRED',
  STAFF_ACCESS_REQUIRED = 'STAFF_ACCESS_REQUIRED',
  BUSINESS_ACCESS_DENIED = 'BUSINESS_ACCESS_DENIED',

  // Generic errors
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Maps error messages to API error codes
 * Used by the HTTP exception filter to enrich error responses
 */
export const ERROR_MESSAGE_TO_CODE_MAP: Record<string, ApiErrorCode> = {
  // User errors
  'User not found': ApiErrorCode.USER_NOT_FOUND,
  'User account is inactive': ApiErrorCode.USER_INACTIVE,
  'Invalid credentials': ApiErrorCode.INVALID_CREDENTIALS,
  'Invalid password': ApiErrorCode.INVALID_PASSWORD,
  'Invalid PIN': ApiErrorCode.INVALID_PIN,

  // Staff errors
  'Staff member not found': ApiErrorCode.STAFF_NOT_FOUND,
  'Staff member not found with this email': ApiErrorCode.STAFF_NOT_FOUND,
  'Staff member not found or invalid PIN authentication method': ApiErrorCode.STAFF_NOT_FOUND,
  'Staff member not found or is inactive': ApiErrorCode.STAFF_INACTIVE,
  'Invalid login method for this staff member': ApiErrorCode.INVALID_STAFF_AUTH_METHOD,
  'Password not configured for this staff member': ApiErrorCode.INVALID_REQUEST,

  // Token errors
  'Invalid or missing token': ApiErrorCode.INVALID_TOKEN,
  'Invalid or missing authentication token': ApiErrorCode.INVALID_TOKEN,
  'Invalid or malformed JWT token': ApiErrorCode.INVALID_TOKEN,
  'Token missing required type field': ApiErrorCode.INVALID_TOKEN,
  'Invalid staff token payload': ApiErrorCode.INVALID_TOKEN,
  'Refresh token not found in cookies': ApiErrorCode.TOKEN_NOT_FOUND,
  'Invalid refresh token payload': ApiErrorCode.INVALID_REFRESH_TOKEN,
  'Invalid or expired refresh token': ApiErrorCode.INVALID_REFRESH_TOKEN,
  'No valid refresh token': ApiErrorCode.TOKEN_NOT_FOUND,

  // Authorization errors
  'Owner access required': ApiErrorCode.OWNER_ACCESS_REQUIRED,
  'Staff access required': ApiErrorCode.STAFF_ACCESS_REQUIRED,
  'You do not have access to this business': ApiErrorCode.BUSINESS_ACCESS_DENIED,
  'User already exists': ApiErrorCode.CONFLICT,
};

/**
 * Get the error code for a given error message
 * Falls back to INTERNAL_ERROR if no mapping found
 */
export function getErrorCode(message: string | string[]): ApiErrorCode {
  if (Array.isArray(message)) {
    // Validation errors come as an array of strings
    // Check if it looks like validation errors (e.g., "email must be an email")
    if (message.length > 0 && message[0]?.includes('must be')) {
      return ApiErrorCode.VALIDATION_ERROR;
    }
    message = message[0] ?? 'Unknown error';
  }

  // Try exact match first
  if (ERROR_MESSAGE_TO_CODE_MAP[message]) {
    return ERROR_MESSAGE_TO_CODE_MAP[message];
  }

  // Try partial matches
  const messageStr = String(message).toLowerCase();
  for (const [errorMsg, code] of Object.entries(ERROR_MESSAGE_TO_CODE_MAP)) {
    if (messageStr.includes(errorMsg.toLowerCase())) {
      return code;
    }
  }

  // Default based on message content
  if (messageStr.includes('not found')) return ApiErrorCode.NOT_FOUND;
  if (messageStr.includes('invalid') && messageStr.includes('field'))
    return ApiErrorCode.VALIDATION_ERROR;
  if (messageStr.includes('unauthorized') || messageStr.includes('denied')) {
    return ApiErrorCode.UNAUTHORIZED;
  }
  if (messageStr.includes('forbidden')) return ApiErrorCode.FORBIDDEN;
  if (messageStr.includes('conflict') || messageStr.includes('already exists')) {
    return ApiErrorCode.CONFLICT;
  }
  if (messageStr.includes('invalid')) return ApiErrorCode.INVALID_REQUEST;

  return ApiErrorCode.INTERNAL_ERROR;
}
