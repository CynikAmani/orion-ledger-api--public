import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ExtractJwt } from 'passport-jwt';
import type { Request, Response } from 'express';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../common/exceptions/app-http.exception';
import { RequestOriginService } from '../../../../core/config/request-origin.service';
import { AUTH_THROTTLE } from '../../../../core/throttling/auth-throttle.util';
import { AllowExpiredSubscription } from '../../shared/decorators/allow-expired-subscription.decorator';
import { Authenticated } from '../../shared/decorators/authenticated.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { GoogleAuthGuard } from '../../shared/guards/google-auth.guard';
import type { AuthenticatedRequest } from '../../shared/guards/permission.guard';
import type { GoogleOAuthProfile } from '../../shared/strategies/google.strategy';
import {
  clearAuthCookies,
  extractAccessTokenFromCookie,
  extractRefreshTokenFromCookie,
  resolveIncomingRefreshToken,
  setAuthCookies,
} from '../../shared/utils/auth-cookie.util';
import { LoginDto } from '../dto/login.dto';
import { RefreshSessionDto } from '../dto/refresh-session.dto';
import { SignupDto } from '../dto/signup.dto';
import {
  AuthService,
  LoginResponse,
  type LoginResult,
} from '../services/auth.service';
import { AuthPayloadService } from '../services/auth-payload.service';
import { GoogleAuthService } from '../services/google-auth.service';
import { ResendMfaDto } from '../../mfa/dto/resend-mfa.dto';
import { VerifyMfaDto } from '../../mfa/dto/verify-mfa.dto';
import {
  MfaService,
  type MfaRequiredResponse,
  type ResendMfaResponse,
} from '../../mfa/services/mfa.service';

@ApiTags('Auth')
@AllowExpiredSubscription()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly authPayloadService: AuthPayloadService,
    private readonly mfaService: MfaService,
    private readonly requestOriginService: RequestOriginService,
  ) {}

  @Public()
  @Throttle({
    auth: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttl },
  })
  @Post('login')
  @ApiOperation({
    summary: 'Sign in with email or username and password',
    description:
      'Tenant staff receive user.tenant.subscription with the current access state, days remaining, plan, and platformContact (Orion Call / WhatsApp / Email). user.support carries the support shortcut: staff newTicketCount and replyCount, or a customer replyCount with newTicketCount 0. user.onlineRepaymentsEnabled is the platform global online-checkout kill-switch. The dashboard can read these from the stored login or session payload.',
  })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  @ApiAcceptedResponse({
    description: 'Credentials valid; MFA verification required',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResult> {
    const result = await this.authService.login(loginDto);

    if (this.isMfaRequiredResponse(result)) {
      response.status(202);
      return result;
    }

    setAuthCookies(response, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'Account created and authenticated',
  })
  @ApiConflictResponse({
    description: 'Unable to create account with the provided details',
  })
  async signup(
    @Body() signupDto: SignupDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.signup(signupDto);
    setAuthCookies(response, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result;
  }

  @Public()
  @Throttle({
    auth: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttl },
  })
  @Post('verify-mfa')
  @ApiOperation({ summary: 'Verify MFA PIN and complete sign-in' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired MFA token' })
  async verifyMfa(
    @Body() dto: VerifyMfaDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.mfaService.verifyMfa(dto);
    setAuthCookies(response, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result;
  }

  @Public()
  @Throttle({
    auth: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttl },
  })
  @Post('resend-mfa')
  @ApiOperation({ summary: 'Resend MFA PIN email' })
  @ApiResponse({ status: 200, description: 'New MFA PIN sent' })
  @ApiTooManyRequestsResponse({
    description: 'Resend limit or cooldown exceeded',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired MFA token' })
  resendMfa(@Body() dto: ResendMfaDto): Promise<ResendMfaResponse> {
    return this.mfaService.resendMfa(dto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access and refresh tokens',
    description:
      'Session identity is bound to the refresh token (body or httpOnly cookie). Do not send userId. Returns the same LoginResponse shape as login/session, including user.onlineRepaymentsEnabled.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed with current session user payload',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh session' })
  refresh(
    @Req() request: Request,
    @Body() body: RefreshSessionDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const refreshToken = resolveIncomingRefreshToken(request, body.refreshToken);

    if (!refreshToken) {
      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Invalid refresh session',
        APP_ERROR_CODES.INVALID_REFRESH_SESSION,
      );
    }

    return this.authService.refreshSession(refreshToken).then((result) => {
      setAuthCookies(response, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      return result;
    });
  }

  @Authenticated()
  @Post('logout')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Logout (revoke refresh session)' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    clearAuthCookies(response);
    return this.authService.logout(request.user.id);
  }

  @Authenticated()
  @Get('session')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Recover authenticated session payload',
    description:
      'Returns the same user payload as login, including user.onlineRepaymentsEnabled, user.tenant.subscription for tenant staff, and user.support for the support shortcut.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user session payload',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getSession(@Req() request: AuthenticatedRequest): Promise<LoginResponse> {
    const accessToken =
      extractAccessTokenFromCookie(request) ??
      ExtractJwt.fromAuthHeaderAsBearerToken()(request) ??
      '';
    const refreshToken = extractRefreshTokenFromCookie(request) ?? '';

    return this.authPayloadService.buildLoginResponse(request.user.id, {
      accessToken,
      refreshToken,
    });
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth(): void {
    // Passport initiates the Google OAuth redirect.
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() request: Request & { user: GoogleOAuthProfile },
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.googleAuthService.validateOrCreateOAuthUser(
      request.user,
    );

    const frontendOrigin = this.requestOriginService.resolveFromOauthState(
      request.query.state,
      request,
    );

    if (this.isMfaRequiredResponse(result)) {
      const params = new URLSearchParams({
        status: 'mfa_required',
        mfaToken: result.mfaToken,
      });
      response.redirect(`${frontendOrigin}/auth/callback?${params.toString()}`);
      return;
    }

    setAuthCookies(response, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    response.redirect(`${frontendOrigin}/auth/callback`);
  }

  private isMfaRequiredResponse(
    result: LoginResult,
  ): result is MfaRequiredResponse {
    return 'status' in result && result.status === 'mfa_required';
  }
}
