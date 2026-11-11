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
import { PasswordResetConfirmDto } from '../dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from '../dto/password-reset-request.dto';
import { PasswordResetVerifyDto } from '../dto/password-reset-verify.dto';
import {
  PasswordResetService,
  type PasswordResetRequestResponse,
} from '../services/password-reset.service';

@ApiTags('Auth')
@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Public()
  @Throttle({
    auth: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttl },
  })
  @Post('request')
  @ApiOperation({ summary: 'Request a password reset verification code' })
  @ApiResponse({ status: 200, description: 'Generic success response' })
  @ApiTooManyRequestsResponse({ description: 'Too many reset requests' })
  requestPasswordReset(
    @Body() dto: PasswordResetRequestDto,
  ): Promise<PasswordResetRequestResponse> {
    return this.passwordResetService.requestReset(dto);
  }

  @Public()
  @Throttle({
    auth: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttl },
  })
  @Post('verify')
  @ApiOperation({ summary: 'Verify a password reset PIN' })
  @ApiResponse({ status: 200, description: 'PIN is valid' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired PIN' })
  @ApiTooManyRequestsResponse({ description: 'Too many verification attempts' })
  verifyPasswordResetPin(
    @Body() dto: PasswordResetVerifyDto,
  ): Promise<{ message: string }> {
    return this.passwordResetService.verifyPin(dto);
  }

  @Public()
  @Throttle({
    auth: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttl },
  })
  @Post('confirm')
  @ApiOperation({ summary: 'Confirm a new password after PIN verification' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired PIN' })
  @ApiTooManyRequestsResponse({ description: 'Too many confirmation attempts' })
  confirmPasswordReset(
    @Body() dto: PasswordResetConfirmDto,
  ): Promise<{ message: string }> {
    return this.passwordResetService.confirmPassword(dto);
  }
}
