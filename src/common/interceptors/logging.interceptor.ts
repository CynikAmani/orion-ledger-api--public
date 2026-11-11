import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const REQUEST_ID_HEADERS = [
  'x-request-id',
  'x-correlation-id',
  'request-id',
] as const;

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const method = request.method;
    const url = request.originalUrl;
    const requestId = this.resolveRequestId(request);
    const startedAt = performance.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequestOutcome({
            method,
            url,
            requestId,
            startedAt,
            statusCode: response.statusCode,
          });
        },
        error: (error: unknown) => {
          const statusCode =
            error instanceof HttpException
              ? error.getStatus()
              : response.statusCode || 500;

          this.logRequestOutcome({
            method,
            url,
            requestId,
            startedAt,
            statusCode,
          });
        },
      }),
    );
  }

  private resolveRequestId(request: Request): string | undefined {
    for (const header of REQUEST_ID_HEADERS) {
      const value = request.headers[header];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
      if (Array.isArray(value) && value[0]) {
        return value[0];
      }
    }

    return undefined;
  }

  private logRequestOutcome(params: {
    method: string;
    url: string;
    requestId?: string;
    startedAt: number;
    statusCode: number;
  }): void {
    const durationMs = Math.round(performance.now() - params.startedAt);
    const statusText = this.resolveStatusText(params.statusCode);
    const requestIdSuffix = params.requestId
      ? ` reqId=${params.requestId}`
      : '';

    this.logger.log(
      `${params.method} ${params.url} - ${params.statusCode} ${statusText} +${durationMs}ms${requestIdSuffix}`,
    );
  }

  private resolveStatusText(statusCode: number): string {
    return STATUS_CODES[statusCode] ?? 'Unknown';
  }
}
