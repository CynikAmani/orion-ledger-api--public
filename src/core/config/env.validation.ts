import * as Joi from 'joi';
import { PAYCHANGU_MODE } from './paychangu-mode.constant';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().port().default(3000),
  PLATFORM_NAME: Joi.string().trim().min(1).max(80).required(),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION_TIME: Joi.alternatives()
    .try(Joi.string(), Joi.number())
    .default('3600s'),
  SWAGGER_ENABLED: Joi.boolean().default(
    Joi.ref('NODE_ENV', { adjust: (v) => v !== 'production' }),
  ),
  // Non-guessable path segment(s); required so docs are not left at /docs.
  SWAGGER_PATH: Joi.string()
    .trim()
    .min(12)
    .max(128)
    .pattern(/^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/)
    .invalid('docs', 'swagger', 'api-docs', 'documentation', 'openapi')
    .required(),
  REDIS_HOST: Joi.string().trim().required(),
  REDIS_PORT: Joi.number().port().required(),
  REDIS_PASSWORD: Joi.string().required(),
  REDIS_USERNAME: Joi.string().trim().default('default'),
  REDIS_TLS: Joi.boolean().default(false),
  BREVO_API_KEY: Joi.string().trim().required(),
  BREVO_SENDER_EMAIL: Joi.string().trim().email().required(),
  BREVO_SENDER_NAME: Joi.string().trim().required(),
  FRONTEND_BASE_URL: Joi.string().trim().uri().required(),
  ALLOWED_ORIGINS: Joi.string()
    .trim()
    .required()
    .custom((value: string, helpers) => {
      const parts = value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      if (parts.length === 0) {
        return helpers.error('any.invalid');
      }

      for (const part of parts) {
        try {
          const url = new URL(part);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return helpers.error('any.invalid');
          }
        } catch {
          return helpers.error('any.invalid');
        }
      }

      return value;
    }, 'comma-separated http(s) origins'),
  API_PUBLIC_BASE_URL: Joi.string().trim().uri().optional(),
  // PAYCHANGU_MODE selects test vs live credentials. Payment logic does not branch on it.
  PAYCHANGU_MODE: Joi.string()
    .valid(PAYCHANGU_MODE.TEST, PAYCHANGU_MODE.LIVE)
    .default(PAYCHANGU_MODE.TEST),
  PAYCHANGU_TEST_PUBLIC_KEY: Joi.string().trim().allow('').default(''),
  PAYCHANGU_TEST_SECRET_KEY: Joi.string().trim().allow('').default(''),
  PAYCHANGU_TEST_WEBHOOK_SECRET: Joi.string().trim().allow('').default(''),
  PAYCHANGU_LIVE_PUBLIC_KEY: Joi.string().trim().allow('').default(''),
  PAYCHANGU_LIVE_SECRET_KEY: Joi.string().trim().allow('').default(''),
  PAYCHANGU_LIVE_WEBHOOK_SECRET: Joi.string().trim().allow('').default(''),
  PAYCHANGU_BASE_URL: Joi.string()
    .trim()
    .uri()
    .default('https://api.paychangu.com'),
});
