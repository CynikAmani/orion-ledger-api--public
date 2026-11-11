import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  APPLICANT_ACTIVE_TENANT_WHERE,
  PUBLIC_ACTIVE_TENANT_WHERE,
  TenantService,
  applicantActiveTenantWhere,
} from './tenant.service';

describe('PUBLIC_ACTIVE_TENANT_WHERE', () => {
  it('excludes demo institutions from the public applicant pool', () => {
    expect(PUBLIC_ACTIVE_TENANT_WHERE).toEqual(
      expect.objectContaining({
        isActive: true,
        deletedAt: null,
        isDemo: false,
      }),
    );
  });
});

describe('applicantActiveTenantWhere', () => {
  it('keeps the demo gate when includeDemo is false', () => {
    expect(applicantActiveTenantWhere(false)).toEqual(
      PUBLIC_ACTIVE_TENANT_WHERE,
    );
  });

  it('omits the demo gate when includeDemo is true', () => {
    expect(applicantActiveTenantWhere(true)).toEqual(
      APPLICANT_ACTIVE_TENANT_WHERE,
    );
    expect(applicantActiveTenantWhere(true)).not.toHaveProperty('isDemo');
  });
});

describe('TenantService.resolveTenantByIdentifier', () => {
  const findFirst = jest.fn<(args?: unknown) => Promise<unknown>>();
  const isEnabled = jest.fn<() => Promise<boolean>>();
  let service: TenantService;

  beforeEach(() => {
    jest.clearAllMocks();
    isEnabled.mockResolvedValue(false);
    service = new TenantService(
      {
        tenant: { findFirst },
      } as never,
      {
        isEnabled,
      } as never,
    );
  });

  it('returns 404 when the identifier is missing instead of crashing on trim', async () => {
    await expect(service.resolveTenantByIdentifier(undefined)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.resolveTenantByIdentifier(null)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 for a blank identifier', async () => {
    await expect(service.resolveTenantByIdentifier('   ')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('never consults the include-demo flag for public resolve', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.resolveTenantByIdentifier('acme'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(isEnabled).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDemo: false }),
      }),
    );
  });

  it('includes demo tenants when allowDemoWhenEnabled and flag are on', async () => {
    isEnabled.mockResolvedValue(true);
    findFirst.mockResolvedValue(null);

    await expect(
      service.resolveTenantByIdentifier('demo-brand', {
        allowDemoWhenEnabled: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(isEnabled).toHaveBeenCalled();
    const where = (
      findFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    ).where;
    expect(where).not.toHaveProperty('isDemo');
  });
});
