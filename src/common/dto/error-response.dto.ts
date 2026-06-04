import { ApiProperty } from '@nestjs/swagger';

/**
 * Standardized error response format for all API endpoints
 * Helps frontend properly handle different error types
 */
export class ErrorResponseDto {
  @ApiProperty({ description: 'HTTP status code', example: 401 })
  statusCode: number;

  @ApiProperty({ description: 'ISO 8601 timestamp of error', example: '2026-06-01T15:24:13.582Z' })
  timestamp: string;

  @ApiProperty({ description: 'Request path', example: '/api/auth/login' })
  path: string;

  @ApiProperty({ description: 'Error message', example: 'User not found' })
  message: string;

  @ApiProperty({
    description: 'Request ID for correlation/debugging',
    example: '0e2615b4-8011-4f7e-90b3-989727fc785a',
  })
  requestId: string;

  @ApiProperty({
    description: 'Error code for fine-grained frontend error handling',
    example: 'USER_NOT_FOUND',
    enum: [
      'USER_NOT_FOUND',
      'USER_INACTIVE',
      'INVALID_CREDENTIALS',
      'INVALID_PASSWORD',
      'INVALID_PIN',
      'STAFF_NOT_FOUND',
      'STAFF_INACTIVE',
      'INVALID_TOKEN',
      'INVALID_REFRESH_TOKEN',
      'TOKEN_EXPIRED',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ],
  })
  errorCode?: string;

  @ApiProperty({
    description: 'Array of validation errors if applicable',
    example: [{ field: 'email', message: 'Invalid email format' }],
    required: false,
  })
  errors?: Array<{ field?: string; message: string }>;
}
