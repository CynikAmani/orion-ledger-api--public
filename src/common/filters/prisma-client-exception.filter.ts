import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { buildErrorResponse, ErrorResponse } from './error-response.interface';

interface MappedPrismaError {
  statusCode: number;
  message: string;
  errorCode: string;
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string }>();

    this.logger.error(
      `[${exception.code}] ${exception.message}`,
      exception.stack,
      { meta: exception.meta },
    );

    const mapped = this.mapPrismaError(exception);
    const payload: ErrorResponse = buildErrorResponse(
      mapped.statusCode,
      request.url,
      mapped.message,
      mapped.errorCode,
    );

    response.status(mapped.statusCode).json(payload);
  }

  private mapPrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): MappedPrismaError {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Resource already exists',
          errorCode: 'ERR_DB_UNIQUE_VIOLATION',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Related record not found',
          errorCode: 'ERR_DB_FOREIGN_KEY_VIOLATION',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          errorCode: 'ERR_DB_RECORD_NOT_FOUND',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred',
          errorCode: 'ERR_DB_INTERNAL',
        };
    }
  }
}
