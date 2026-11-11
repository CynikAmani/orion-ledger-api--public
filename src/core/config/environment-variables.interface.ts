import type { PaychanguMode } from './paychangu-mode.constant';

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  PLATFORM_NAME: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRATION_TIME: string | number;
  SWAGGER_ENABLED: boolean;
  SWAGGER_PATH: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  REDIS_USERNAME: string;
  REDIS_TLS: boolean;
  BREVO_API_KEY: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  FRONTEND_BASE_URL: string;
  ALLOWED_ORIGINS: string;
  API_PUBLIC_BASE_URL?: string;
  PAYCHANGU_MODE: PaychanguMode;
  PAYCHANGU_TEST_PUBLIC_KEY: string;
  PAYCHANGU_TEST_SECRET_KEY: string;
  PAYCHANGU_TEST_WEBHOOK_SECRET: string;
  PAYCHANGU_LIVE_PUBLIC_KEY: string;
  PAYCHANGU_LIVE_SECRET_KEY: string;
  PAYCHANGU_LIVE_WEBHOOK_SECRET: string;
  PAYCHANGU_BASE_URL: string;
}
