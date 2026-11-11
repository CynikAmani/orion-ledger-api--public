import { describe, expect, it } from '@jest/globals';
import { PERMISSION_METADATA_KEY } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { MeController } from './me.controller';

describe('MeController permission metadata', () => {
  it('uses self:* permissions, not User Management platform|tenant:users:*', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        MeController.prototype.getProfile,
      ),
    ).toBe(PERMISSIONS.SELF.READ);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        MeController.prototype.updateProfile,
      ),
    ).toBe(PERMISSIONS.SELF.UPDATE);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        MeController.prototype.softDelete,
      ),
    ).toBe(PERMISSIONS.SELF.DELETE);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        MeController.prototype.getIdentityDocument,
      ),
    ).toBe(PERMISSIONS.SELF.READ);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        MeController.prototype.upsertIdentityDocument,
      ),
    ).toBe(PERMISSIONS.SELF.UPDATE);

    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        MeController.prototype.getProfile,
      ),
    ).not.toBe(PERMISSIONS.PLATFORM.USERS_READ);
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        MeController.prototype.getProfile,
      ),
    ).not.toBe(PERMISSIONS.PLATFORM.USERS_VIEW);
  });
});
