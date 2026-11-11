import { Controller, Post, Req, Res } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { extractPublicAuditRequestContext } from '../../../core/audit/utils/audit-request-context.util';
import { AUTH_THROTTLE } from '../../../core/throttling/auth-throttle.util';
import { Public } from '../../auth/shared/decorators/public.decorator';
import { setAuthCookies } from '../../auth/shared/utils/auth-cookie.util';
import {
  SandboxService,
  type SandboxSessionResponse,
} from '../services/sandbox.service';

@ApiTags('Sandbox')
@Controller('sandbox')
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  @Public()
  @Throttle({
    auth: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttl },
  })
  @Post('sessions')
  @ApiOperation({
    summary: 'Start a one-hour sandbox session on a demo institution',
    description:
      "Signs in the institution's permanent demo administrator and returns the same payload as login plus expiresAt. No password is issued. Each call opens its own session. When expiresAt passes, that session's refresh token is revoked through the normal expired-session response. The demo user, the institution, and data changed during the visit stay.",
  })
  @ApiResponse({ status: 201, description: 'Sandbox session started' })
  @ApiServiceUnavailableResponse({
    description: 'No demo institution is available',
  })
  @ApiTooManyRequestsResponse({ description: 'Too many sandbox starts' })
  async start(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SandboxSessionResponse> {
    const result = await this.sandboxService.start(
      extractPublicAuditRequestContext(request),
    );
    const maxAgeMs = Math.max(
      0,
      new Date(result.expiresAt).getTime() - Date.now(),
    );

    setAuthCookies(
      response,
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      { maxAgeMs },
    );

    return result;
  }
}
