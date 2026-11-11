import { describe, expect, it } from '@jest/globals';
import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';
import { permissionsForSandboxSession } from './sandbox-permissions.util';

describe('permissionsForSandboxSession', () => {
  const granted = [
    PERMISSIONS.TENANT.USERS_READ,
    PERMISSIONS.TENANT.USERS_CREATE,
    PERMISSIONS.TENANT.ROLES_VIEW,
    PERMISSIONS.TENANT.ROLES_DELETE,
    PERMISSIONS.TENANT.LOANS_READ,
    PERMISSIONS.PLATFORM.USERS_UPDATE,
    PERMISSIONS.GLOBAL.SELF_UPDATE,
  ];

  it('leaves an ordinary session unchanged', () => {
    expect(permissionsForSandboxSession(granted, false)).toEqual(granted);
  });

  it('keeps reads and drops user and role mutations', () => {
    expect(permissionsForSandboxSession(granted, true)).toEqual([
      PERMISSIONS.TENANT.USERS_READ,
      PERMISSIONS.TENANT.ROLES_VIEW,
      PERMISSIONS.TENANT.LOANS_READ,
      PERMISSIONS.GLOBAL.SELF_UPDATE,
    ]);
  });
});
