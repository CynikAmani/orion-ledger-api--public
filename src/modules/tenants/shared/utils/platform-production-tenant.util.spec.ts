import { PLATFORM_PRODUCTION_TENANT_WHERE } from './platform-production-tenant.util';

describe('PLATFORM_PRODUCTION_TENANT_WHERE', () => {
  it('excludes soft-deleted and demo institutions', () => {
    expect(PLATFORM_PRODUCTION_TENANT_WHERE).toEqual({
      deletedAt: null,
      isDemo: false,
    });
  });
});
