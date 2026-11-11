import { describe, expect, it } from '@jest/globals';
import { PERMISSION_METADATA_KEY } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { PlatformTenantsController } from './platform-tenants.controller';

describe('PlatformTenantsController permission metadata', () => {
  it('gates tenant-member identity documents with platform:tenants:read', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformTenantsController.prototype.getTenantMember,
      ),
    ).toBe(PERMISSIONS.PLATFORM.TENANTS_READ);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformTenantsController.prototype.getTenantMemberIdentityDocument,
      ),
    ).toBe(PERMISSIONS.PLATFORM.TENANTS_READ);
  });
});
