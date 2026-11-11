import { describe, expect, it } from '@jest/globals';
import {
  isCustomerOpsPermission,
  isGlobalPermission,
  isInboxNotificationPermission,
  isPermissionInScope,
  isSelfPermission,
  PLATFORM_PERMISSION_PREFIX,
  TENANT_PERMISSION_PREFIX,
} from './role-permission-scope.util';

describe('role-permission-scope.util', () => {
  it('accepts platform permissions only under the platform prefix', () => {
    expect(
      isPermissionInScope('platform:roles:manage', PLATFORM_PERMISSION_PREFIX),
    ).toBe(true);
    expect(
      isPermissionInScope('tenant:roles:manage', PLATFORM_PERMISSION_PREFIX),
    ).toBe(false);
    expect(isPermissionInScope('role:manage', PLATFORM_PERMISSION_PREFIX)).toBe(
      false,
    );
  });

  it('accepts tenant permissions only under the tenant prefix', () => {
    expect(
      isPermissionInScope('tenant:users:read', TENANT_PERMISSION_PREFIX),
    ).toBe(true);
    expect(
      isPermissionInScope('platform:roles:read', TENANT_PERMISSION_PREFIX),
    ).toBe(false);
  });

  it('treats self:* as in-scope for both platform and tenant Role Management', () => {
    expect(isSelfPermission('self:view')).toBe(true);
    expect(isGlobalPermission('self:view')).toBe(true);
    expect(isPermissionInScope('self:read', PLATFORM_PERMISSION_PREFIX)).toBe(
      true,
    );
    expect(isPermissionInScope('self:update', TENANT_PERMISSION_PREFIX)).toBe(
      true,
    );
    expect(isPermissionInScope('self:delete', PLATFORM_PERMISSION_PREFIX)).toBe(
      true,
    );
  });

  it('treats inbox notification view/read/delete as global, not notification:create', () => {
    expect(isInboxNotificationPermission('notification:read')).toBe(true);
    expect(isGlobalPermission('notification:view')).toBe(true);
    expect(isGlobalPermission('notification:delete')).toBe(true);
    expect(isInboxNotificationPermission('notification:create')).toBe(false);
    expect(isGlobalPermission('notification:create')).toBe(false);
    expect(
      isPermissionInScope('notification:read', PLATFORM_PERMISSION_PREFIX),
    ).toBe(true);
    expect(
      isPermissionInScope('notification:view', TENANT_PERMISSION_PREFIX),
    ).toBe(true);
    expect(
      isPermissionInScope('notification:create', PLATFORM_PERMISSION_PREFIX),
    ).toBe(false);
    expect(
      isPermissionInScope('notification:create', TENANT_PERMISSION_PREFIX),
    ).toBe(false);
  });

  it('includes platform:customers:* natively on platform Role Management', () => {
    expect(isCustomerOpsPermission('platform:customers:read')).toBe(true);
    expect(
      isPermissionInScope(
        'platform:customers:read',
        PLATFORM_PERMISSION_PREFIX,
      ),
    ).toBe(true);
    expect(
      isPermissionInScope(
        'platform:customers:loan-activity:read',
        PLATFORM_PERMISSION_PREFIX,
      ),
    ).toBe(true);
  });

  it('allows platform:customers:* on tenant Role Management for staff customer ops', () => {
    expect(
      isPermissionInScope('platform:customers:read', TENANT_PERMISSION_PREFIX),
    ).toBe(true);
    expect(
      isPermissionInScope(
        'platform:customers:eligibility:read',
        TENANT_PERMISSION_PREFIX,
      ),
    ).toBe(true);
    expect(
      isPermissionInScope(
        'platform:customer:applications:create',
        TENANT_PERMISSION_PREFIX,
      ),
    ).toBe(false);
  });
});
