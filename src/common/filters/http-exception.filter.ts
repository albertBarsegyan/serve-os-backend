import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { getErrorCode } from '@common/enums/api-error-code.enum';

type HttpRequestWithMeta = Request & { id?: string };

function resolveExceptionMessage(exception: unknown): string | string[] {
  if (!(exception instanceof HttpException)) {
    return 'Internal server error';
  }

  const exceptionResponse = exception.getResponse();
  if (
    typeof exceptionResponse === 'object' &&
    exceptionResponse !== null &&
    'message' in exceptionResponse
  ) {
    const responseMessage = exceptionResponse.message;
    if (typeof responseMessage === 'string' || Array.isArray(responseMessage)) {
      return responseMessage;
    }
  }

  return exception.message;
}

function isValidationError(exception: HttpException): boolean {
  // Check if this is a validation error by status code
  return exception.getStatus() === 400;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<HttpRequestWithMeta>();

    const statusCode: number =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = resolveExceptionMessage(exception);

    // For validation errors, always use VALIDATION_ERROR code
    const isValidation = exception instanceof HttpException && isValidationError(exception);
    const errorCode = isValidation ? 'VALIDATION_ERROR' : getErrorCode(message);

    const errorPayload = {
      statusCode,
      path: request.url,
      method: request.method,
      requestId: request.id,
      message,
      errorCode,
    };

    if (statusCode >= 500) {
      this.logger.error(errorPayload, 'Unhandled exception returned to client');
    } else {
      this.logger.warn(errorPayload, 'HTTP exception returned to client');
    }

    const responseBody: {
      statusCode: number;
      timestamp: string;
      path: string;
      message: string | string[];
      requestId?: string;
      errorCode: string;
      errors?: Array<{ message: string }>;
    } = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      requestId: request.id,
      errorCode,
    };

    // Include detailed validation errors if available
    if (isValidation && exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse &&
        Array.isArray(exceptionResponse.message)
      ) {
        responseBody.errors = (exceptionResponse.message as string[]).map((msg: string) => ({
          message: msg,
        }));
      }
    }

    response.status(statusCode).json(responseBody);
  }
}
