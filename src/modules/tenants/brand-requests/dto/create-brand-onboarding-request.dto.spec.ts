import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { CreateBrandOnboardingRequestDto } from './create-brand-onboarding-request.dto';
import { UpdateBrandOnboardingRequestDto } from './update-brand-onboarding-request.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function transform(
  payload: Record<string, unknown>,
): Promise<CreateBrandOnboardingRequestDto> {
  return pipe.transform(payload, {
    type: 'body',
    metatype: CreateBrandOnboardingRequestDto,
    data: '',
  }) as Promise<CreateBrandOnboardingRequestDto>;
}

describe('CreateBrandOnboardingRequestDto', () => {
  const valid = {
    brandName: 'Acme Finance',
    slug: 'acme-finance',
    tenantCode: 'ACME01',
    contactEmail: 'hello@acme-finance.com',
  };

  it('accepts a valid payload and uppercases tenantCode', async () => {
    const dto = await transform({
      ...valid,
      tenantCode: 'acme01',
      contactPhone: '+265999000111',
    });

    expect(dto.tenantCode).toBe('ACME01');
    expect(dto.slug).toBe('acme-finance');
    expect(dto.contactPhone).toBe('+265999000111');
  });

  it('rejects a non URL-safe slug', async () => {
    await expect(
      transform({ ...valid, slug: 'Acme Finance' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid email', async () => {
    await expect(
      transform({ ...valid, contactEmail: 'not-an-email' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects injected status fields', async () => {
    await expect(
      transform({ ...valid, status: 'APPROVED' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UpdateBrandOnboardingRequestDto', () => {
  it('accepts a partial payload', async () => {
    const dto = await pipe.transform(
      { brandName: 'Acme Credit' },
      {
        type: 'body',
        metatype: UpdateBrandOnboardingRequestDto,
        data: '',
      },
    );

    expect(dto).toEqual({ brandName: 'Acme Credit' });
  });

  it('rejects injected status fields', async () => {
    await expect(
      pipe.transform(
        { brandName: 'Acme Credit', status: 'APPROVED' },
        {
          type: 'body',
          metatype: UpdateBrandOnboardingRequestDto,
          data: '',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
