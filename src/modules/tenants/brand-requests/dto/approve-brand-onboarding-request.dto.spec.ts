import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { ApproveBrandOnboardingRequestDto } from './approve-brand-onboarding-request.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function transform(
  payload: Record<string, unknown>,
): Promise<ApproveBrandOnboardingRequestDto> {
  return pipe.transform(payload, {
    type: 'body',
    metatype: ApproveBrandOnboardingRequestDto,
    data: '',
  }) as Promise<ApproveBrandOnboardingRequestDto>;
}

describe('ApproveBrandOnboardingRequestDto', () => {
  it('accepts an empty body (open-ended trial)', async () => {
    const dto = await transform({});
    expect(dto.trialEndsAt).toBeUndefined();
  });

  it('accepts trialEndsAt as an ISO date', async () => {
    const dto = await transform({
      trialEndsAt: '2026-11-15T00:00:00.000Z',
    });

    expect(dto.trialEndsAt).toEqual(new Date('2026-11-15T00:00:00.000Z'));
  });

  it('rejects a non-date trialEndsAt', async () => {
    await expect(
      transform({ trialEndsAt: 'not-a-date' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
