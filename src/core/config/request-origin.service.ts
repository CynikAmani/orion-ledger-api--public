import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { getAllowedOriginsFromConfig } from './allowed-origins.util';
import type { EnvironmentVariables } from './environment-variables.interface';
import {
  resolveOauthFrontendOrigin,
  resolveRequestOrigin,
} from './request-origin.util';

@Injectable()
export class RequestOriginService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  /**
   * Frontend origin of this request, allowlisted via ALLOWED_ORIGINS / subscribers.
   * Used for email links and OAuth redirects — never FRONTEND_BASE_URL as the URL host.
   */
  resolve(request: Pick<Request, 'headers' | 'query'>): string {
    return resolveRequestOrigin(request, this.allowedOrigins());
  }

  resolveFromOauthState(
    state: unknown,
    request: Pick<Request, 'headers' | 'query'>,
  ): string {
    return resolveOauthFrontendOrigin(state, request, this.allowedOrigins());
  }

  private allowedOrigins(): string[] {
    return getAllowedOriginsFromConfig(this.configService);
  }
}
