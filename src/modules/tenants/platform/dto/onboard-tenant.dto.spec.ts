import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { OnboardTenantDto } from './onboard-tenant.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const validRepresentative = {
  email: 'jane.doe@acme-finance.com',
  firstName: 'Jane',
  lastName: 'Doe',
  userId: 'jane.doe',
  nationalId: 'NAT-123-456-789',
};

const valid = {
  name: 'Acme Finance',
  slug: 'acme-finance',
  tenantCode: 'ACME01',
  representative: validRepresentative,
};

async function transform(
  payload: Record<string, unknown>,
): Promise<OnboardTenantDto> {
  return pipe.transform(payload, {
    type: 'body',
    metatype: OnboardTenantDto,
    data: '',
  }) as Promise<OnboardTenantDto>;
}

describe('OnboardTenantDto', () => {
  it('accepts a valid payload without isDemo (frontend omits → production)', async () => {
    const dto = await transform(valid);

    expect(dto.isDemo).toBeUndefined();
    expect(dto.name).toBe('Acme Finance');
  });

  it('accepts isDemo: true for demo institutions', async () => {
    const dto = await transform({ ...valid, isDemo: true });

    expect(dto.isDemo).toBe(true);
  });

  it('accepts isDemo: false explicitly', async () => {
    const dto = await transform({ ...valid, isDemo: false });

    expect(dto.isDemo).toBe(false);
  });

  it('rejects a non-boolean isDemo', async () => {
    await expect(
      transform({ ...valid, isDemo: 'yes' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
