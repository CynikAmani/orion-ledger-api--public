import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AUTH_THROTTLE } from '../../../../core/throttling/auth-throttle.util';
import { Public } from '../../shared/decorators/public.decorator';
import { SetAccountAccessPasswordDto } from '../dto/set-account-access-password.dto';
import { ValidateAccountAccessTokenDto } from '../dto/validate-account-access-token.dto';
import {
  AccountAccessLinkContext,
  AccountAccessTokenService,
} from '../services/account-access-token.service';
import { AccountAccessService } from '../services/account-access.service';

/**
 * Admin-driven link flows only (initial setup + admin recovery).
 * Self-service login and PIN password reset live in sibling auth modules.
 */
@ApiTags('Auth')
@Controller('auth/account-access')
export class AccountAccessController {
  constructor(
    private readonly accountAccessTokenService: AccountAccessTokenService,
    private readonly accountAccessService: AccountAccessService,
  ) {}

  @Public()
  @Throttle({
    auth: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttl },
  })
  @Post('validate')
  @ApiOperation({
    summary: 'Validate an account setup or recovery email link',
  })
  @ApiResponse({ status: 200, description: 'Link is valid' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired link' })
  @ApiTooManyRequestsResponse({ description: 'Too many validation attempts' })
  validateLink(
    @Body() dto: ValidateAccountAccessTokenDto,
  ): Promise<AccountAccessLinkContext> {
    return this.accountAccessTokenService.assertValidLink(dto.userId, dto.token);
  }

  @Public()
  @Throttle({
    auth: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttl },
  })
  @Post('set-password')
  @ApiOperation({
    summary: 'Set a password from a valid account setup or recovery link',
  })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired link' })
  @ApiTooManyRequestsResponse({ description: 'Too many set-password attempts' })
  setPassword(
    @Body() dto: SetAccountAccessPasswordDto,
  ): Promise<{ message: string }> {
    return this.accountAccessService.setPassword(dto);
  }
}
