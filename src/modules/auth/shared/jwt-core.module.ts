import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { CONFIG_KEYS, type EnvironmentVariables } from '../../../core/config';
import { resolveJwtExpiresIn } from './utils/jwt-expiration.util';

function resolveJwtSecret(secret: string | undefined): string {
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined');
  }

  return secret;
}

/**
 * Single configured JwtModule for the entire auth tree.
 * Session tokens (login) and account-access link tokens share the same secret
 * but use different payloads and expiries at sign time.
 *
 * Session access tokens must be signed with `buildSessionJwtClaims(userId)`
 * only — never roles, permissions, tenant IDs, or user metadata.
 * Lifetime comes from JWT_EXPIRATION_TIME (not a hardcoded 15m).
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables>) => ({
        secret: resolveJwtSecret(
          config.get(CONFIG_KEYS.JWT_SECRET, { infer: true }),
        ),
        signOptions: {
          expiresIn: resolveJwtExpiresIn(
            config.get(CONFIG_KEYS.JWT_EXPIRATION_TIME, { infer: true }),
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  exports: [JwtModule],
})
export class JwtCoreModule {}
