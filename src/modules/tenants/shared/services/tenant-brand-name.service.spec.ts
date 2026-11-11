import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { FALLBACK_LENDER_DISPLAY_NAME } from '../utils/resolve-tenant-brand-name.util';
import { TenantBrandNameService } from './tenant-brand-name.service';

describe('TenantBrandNameService', () => {
  const findUnique = jest.fn<(args?: unknown) => Promise<unknown>>();
  let service: TenantBrandNameService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantBrandNameService({
      tenant: { findUnique },
    } as never);
  });

  it('returns the brand profile name when set', async () => {
    findUnique.mockResolvedValue({
      name: 'Acme Holdings',
      brandProfile: { brandName: 'Acme Credit' },
    });

    await expect(service.resolveDisplayName('tenant-1')).resolves.toBe(
      'Acme Credit',
    );
  });

  it('falls back to tenant name when brand name is unset', async () => {
    findUnique.mockResolvedValue({
      name: 'Acme Holdings',
      brandProfile: { brandName: null },
    });

    await expect(service.resolveDisplayName('tenant-1')).resolves.toBe(
      'Acme Holdings',
    );
  });

  it('returns the generic lender label when the tenant is missing', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.resolveDisplayName('missing')).resolves.toBe(
      FALLBACK_LENDER_DISPLAY_NAME,
    );
  });
});
