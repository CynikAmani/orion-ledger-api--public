import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { buildErrorResponse, ErrorResponse } from './error-response.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string }>();

    if (exception instanceof HttpException) {
      this.handleHttpException(exception, response, request.url);
      return;
    }

    if (exception instanceof Error) {
      this.handleRuntimeError(exception, response, request.url);
      return;
    }

    this.logger.error('Unknown exception type thrown', String(exception));

    const payload: ErrorResponse = buildErrorResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      request.url,
      'An unexpected error occurred',
      'ERR_INTERNAL_SERVER',
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }

  private handleHttpException(
    exception: HttpException,
    response: Response,
    path: string,
  ): void {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const message = this.extractHttpExceptionMessage(exceptionResponse);
    const errorCode =
      this.extractHttpExceptionErrorCode(exceptionResponse) ??
      this.resolveHttpErrorCode(statusCode);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `HTTP ${statusCode}: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(statusCode).json({
      ...buildErrorResponse(statusCode, path, message, errorCode),
      ...this.extractHttpExceptionExtras(exceptionResponse),
    });
  }

  private handleRuntimeError(
    exception: Error,
    response: Response,
    path: string,
  ): void {
    this.logger.error(exception.message, exception.stack);

    const message = this.isProduction
      ? 'An unexpected error occurred'
      : exception.message;

    const payload: ErrorResponse = buildErrorResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      path,
      message,
      'ERR_INTERNAL_SERVER',
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }

  private extractHttpExceptionMessage(
    exceptionResponse: string | object,
  ): string | string[] {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const { message } = exceptionResponse;

      if (typeof message === 'string') {
        return message;
      }

      if (
        Array.isArray(message) &&
        message.every((item) => typeof item === 'string')
      ) {
        return message;
      }
    }

    return 'Request could not be processed';
  }

  private extractHttpExceptionExtras(
    exceptionResponse: string | object,
  ): Record<string, unknown> {
    if (typeof exceptionResponse !== 'object' || exceptionResponse === null) {
      return {};
    }

    const reserved = new Set(['message', 'error', 'statusCode', 'errorCode']);
    const extras: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(exceptionResponse)) {
      if (!reserved.has(key)) {
        extras[key] = value;
      }
    }

    return extras;
  }

  private extractHttpExceptionErrorCode(
    exceptionResponse: string | object,
  ): string | undefined {
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'errorCode' in exceptionResponse &&
      typeof exceptionResponse.errorCode === 'string'
    ) {
      return exceptionResponse.errorCode;
    }

    return undefined;
  }

  private resolveHttpErrorCode(status: number): string {
    const statusMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'ERR_BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'ERR_UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'ERR_FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'ERR_NOT_FOUND',
      [HttpStatus.CONFLICT]: 'ERR_CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'ERR_UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'ERR_TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'ERR_INTERNAL_SERVER',
    };

    return statusMap[status] ?? 'ERR_HTTP_ERROR';
  }
}
