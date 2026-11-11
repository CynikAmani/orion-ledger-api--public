import { describe, expect, it } from '@jest/globals';
import { PERMISSION_METADATA_KEY } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { PlatformBrandRequestsController } from './platform-brand-requests.controller';

describe('PlatformBrandRequestsController permission metadata', () => {
  it('gates list and detail with platform:brand-requests:read', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformBrandRequestsController.prototype.list,
      ),
    ).toBe(PERMISSIONS.BRAND_REQUESTS.READ);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformBrandRequestsController.prototype.findOne,
      ),
    ).toBe(PERMISSIONS.BRAND_REQUESTS.READ);
  });

  it('gates reject with platform:brand-requests:reject', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformBrandRequestsController.prototype.reject,
      ),
    ).toBe(PERMISSIONS.BRAND_REQUESTS.REJECT);
  });

  it('gates approve with platform:brand-requests:approve', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformBrandRequestsController.prototype.approve,
      ),
    ).toBe(PERMISSIONS.BRAND_REQUESTS.APPROVE);
  });
});
