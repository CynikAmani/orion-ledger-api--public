import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import {
  PAYCHANGU_MODE,
  type EnvironmentVariables,
} from '../../../../../core/config';
import { PaychanguConfigService } from './paychangu-config.service';

describe('PaychanguConfigService', () => {
  const values: Partial<EnvironmentVariables> = {
    PAYCHANGU_MODE: PAYCHANGU_MODE.TEST,
    PAYCHANGU_TEST_PUBLIC_KEY: 'pub-test',
    PAYCHANGU_TEST_SECRET_KEY: 'sec-test',
    PAYCHANGU_TEST_WEBHOOK_SECRET: 'whsec-test',
    PAYCHANGU_LIVE_PUBLIC_KEY: 'pub-live',
    PAYCHANGU_LIVE_SECRET_KEY: 'sec-live',
    PAYCHANGU_LIVE_WEBHOOK_SECRET: 'whsec-live',
    PAYCHANGU_BASE_URL: 'https://api.paychangu.com/',
  };

  const configService = {
    get: jest.fn((key: keyof EnvironmentVariables) => values[key]),
  };

  let service: PaychanguConfigService;

  beforeEach(() => {
    values.PAYCHANGU_MODE = PAYCHANGU_MODE.TEST;
    service = new PaychanguConfigService(
      configService as unknown as ConfigService<EnvironmentVariables, true>,
    );
  });

  it('selects test credentials when PAYCHANGU_MODE=test', () => {
    expect(service.getActiveConfig()).toEqual({
      mode: PAYCHANGU_MODE.TEST,
      publicKey: 'pub-test',
      secretKey: 'sec-test',
      webhookSecret: 'whsec-test',
      baseUrl: 'https://api.paychangu.com',
    });
  });

  it('selects live credentials when PAYCHANGU_MODE=live', () => {
    values.PAYCHANGU_MODE = PAYCHANGU_MODE.LIVE;

    expect(service.getActiveConfig()).toMatchObject({
      mode: PAYCHANGU_MODE.LIVE,
      publicKey: 'pub-live',
      secretKey: 'sec-live',
      webhookSecret: 'whsec-live',
    });
  });
});
