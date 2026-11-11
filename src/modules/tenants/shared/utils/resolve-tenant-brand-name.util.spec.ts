import { describe, expect, it } from '@jest/globals';
import {
  FALLBACK_LENDER_DISPLAY_NAME,
  resolveTenantBrandName,
} from './resolve-tenant-brand-name.util';

describe('resolveTenantBrandName', () => {
  it('prefers the brand profile name', () => {
    expect(
      resolveTenantBrandName({
        tenantName: 'Acme Holdings',
        brandName: 'Acme Credit',
      }),
    ).toBe('Acme Credit');
  });

  it('falls back to the tenant institution name', () => {
    expect(
      resolveTenantBrandName({
        tenantName: 'Acme Holdings',
        brandName: '   ',
      }),
    ).toBe('Acme Holdings');
  });

  it('uses a generic lender label when both names are missing', () => {
    expect(resolveTenantBrandName({})).toBe(FALLBACK_LENDER_DISPLAY_NAME);
  });
});
