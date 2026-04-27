import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<HttpRequestWithMeta>();

    const statusCode: number =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = resolveExceptionMessage(exception);

    const errorPayload = {
      statusCode,
      path: request.url,
      method: request.method,
      requestId: request.id,
      message,
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(errorPayload, 'Unhandled exception returned to client');
    } else {
      this.logger.warn(errorPayload, 'HTTP exception returned to client');
    }

    response.status(statusCode).json({
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
