import { describe, expect, it } from '@jest/globals';
import { PERMISSION_METADATA_KEY } from '../../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../../auth/shared/constants/permissions.constant';
import { PlatformManagedUsersController } from './platform-managed-users.controller';
import { TenantManagedUsersController } from '../../tenant/controllers/tenant-managed-users.controller';

describe('Managed user controller permission metadata', () => {
  it('gates platform User Management with platform:users:*', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformManagedUsersController.prototype.findAll,
      ),
    ).toBe(PERMISSIONS.PLATFORM.USERS_READ);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformManagedUsersController.prototype.getIdentityDocument,
      ),
    ).toBe(PERMISSIONS.PLATFORM.USERS_READ);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformManagedUsersController.prototype.update,
      ),
    ).toBe(PERMISSIONS.PLATFORM.USERS_UPDATE);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformManagedUsersController.prototype.softDelete,
      ),
    ).toBe(PERMISSIONS.PLATFORM.USERS_DELETE);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformManagedUsersController.prototype.updateRoles,
      ),
    ).toBe(PERMISSIONS.PLATFORM.USERS_ASSIGN_ROLES);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformManagedUsersController.prototype.setBlockStatus,
      ),
    ).toBe(PERMISSIONS.PLATFORM.USERS_BLOCK);
  });

  it('gates tenant User Management with tenant:users:*', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        TenantManagedUsersController.prototype.findAll,
      ),
    ).toBe(PERMISSIONS.TENANT.USERS_READ);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        TenantManagedUsersController.prototype.getIdentityDocument,
      ),
    ).toBe(PERMISSIONS.TENANT.USERS_READ);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        TenantManagedUsersController.prototype.updateRoles,
      ),
    ).toBe(PERMISSIONS.TENANT.USERS_ASSIGN_ROLES);
  });
});
