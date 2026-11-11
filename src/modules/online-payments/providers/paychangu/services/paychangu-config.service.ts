import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CONFIG_KEYS,
  PAYCHANGU_MODE,
  type EnvironmentVariables,
  type PaychanguMode,
} from '../../../../../core/config';
import { PAYCHANGU_DEFAULT_BASE_URL } from '../constants/paychangu.constant';

export interface PaychanguActiveConfig {
  mode: PaychanguMode;
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  baseUrl: string;
}

@Injectable()
export class PaychanguConfigService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  getMode(): PaychanguMode {
    const mode = this.configService.get(CONFIG_KEYS.PAYCHANGU_MODE, {
      infer: true,
    });
    return mode === PAYCHANGU_MODE.LIVE
      ? PAYCHANGU_MODE.LIVE
      : PAYCHANGU_MODE.TEST;
  }

  getActiveConfig(): PaychanguActiveConfig {
    const mode = this.getMode();

    if (mode === PAYCHANGU_MODE.LIVE) {
      return {
        mode,
        publicKey: this.read(CONFIG_KEYS.PAYCHANGU_LIVE_PUBLIC_KEY),
        secretKey: this.read(CONFIG_KEYS.PAYCHANGU_LIVE_SECRET_KEY),
        webhookSecret: this.read(CONFIG_KEYS.PAYCHANGU_LIVE_WEBHOOK_SECRET),
        baseUrl: this.readBaseUrl(),
      };
    }

    return {
      mode,
      publicKey: this.read(CONFIG_KEYS.PAYCHANGU_TEST_PUBLIC_KEY),
      secretKey: this.read(CONFIG_KEYS.PAYCHANGU_TEST_SECRET_KEY),
      webhookSecret: this.read(CONFIG_KEYS.PAYCHANGU_TEST_WEBHOOK_SECRET),
      baseUrl: this.readBaseUrl(),
    };
  }

  private read(
    key:
      | typeof CONFIG_KEYS.PAYCHANGU_TEST_PUBLIC_KEY
      | typeof CONFIG_KEYS.PAYCHANGU_TEST_SECRET_KEY
      | typeof CONFIG_KEYS.PAYCHANGU_TEST_WEBHOOK_SECRET
      | typeof CONFIG_KEYS.PAYCHANGU_LIVE_PUBLIC_KEY
      | typeof CONFIG_KEYS.PAYCHANGU_LIVE_SECRET_KEY
      | typeof CONFIG_KEYS.PAYCHANGU_LIVE_WEBHOOK_SECRET,
  ): string {
    return this.configService.get(key, { infer: true })?.trim() ?? '';
  }

  private readBaseUrl(): string {
    const configured = this.configService.get(CONFIG_KEYS.PAYCHANGU_BASE_URL, {
      infer: true,
    });
    const trimmed = configured?.trim();
    return trimmed && trimmed.length > 0
      ? trimmed.replace(/\/+$/, '')
      : PAYCHANGU_DEFAULT_BASE_URL;
  }
}
