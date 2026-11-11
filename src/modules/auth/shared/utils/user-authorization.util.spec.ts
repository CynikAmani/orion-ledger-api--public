import { describe, expect, it } from '@jest/globals';
import {
  extractPermissionNames,
  extractRoleKeys,
  extractTenantContexts,
  type UserAuthorizationGraph,
} from './user-authorization.util';

const customerGraph: UserAuthorizationGraph = {
  userRoles: [
    {
      role: {
        key: 'CUSTOMER',
        rolePermissions: [
          { permission: { name: 'self:read' } },
          { permission: { name: 'self:update' } },
        ],
      },
    },
  ],
};

describe('user-authorization.util', () => {
  it('extracts unique permission names from the live role graph', () => {
    expect(extractRoleKeys(customerGraph)).toEqual(['CUSTOMER']);
    expect(extractPermissionNames(customerGraph)).toEqual([
      'self:read',
      'self:update',
    ]);
  });

  it('returns no tenant contexts when User.tenantId is null (platform)', () => {
    expect(extractTenantContexts(customerGraph)).toEqual([]);
  });

  it('extracts tenant context from User.tenantId, not from UserRole alone', () => {
    const graph: UserAuthorizationGraph = {
      tenantId: 'tenant-a',
      userRoles: [
        {
          tenantId: 'tenant-a',
          role: {
            key: 'BRANCH_OFFICER',
            tenantId: 'tenant-a',
            rolePermissions: [{ permission: { name: 'tenant:loans:read' } }],
          },
        },
        {
          role: {
            key: 'CUSTOMER',
            rolePermissions: [],
          },
        },
      ],
    };

    expect(extractTenantContexts(graph)).toEqual([
      { tenantId: 'tenant-a', roleKey: 'BRANCH_OFFICER' },
    ]);
  });

  it('still records membership when the tenant user has no roles yet', () => {
    const graph: UserAuthorizationGraph = {
      tenantId: 'tenant-a',
      userRoles: [],
    };

    expect(extractTenantContexts(graph)).toEqual([
      { tenantId: 'tenant-a', roleKey: '' },
    ]);
  });

  it('ignores UserRole.tenantId when User.tenantId is null', () => {
    const graph: UserAuthorizationGraph = {
      tenantId: null,
      userRoles: [
        {
          tenantId: 'tenant-a',
          role: {
            key: 'BRANCH_OFFICER',
            tenantId: 'tenant-a',
            rolePermissions: [],
          },
        },
      ],
    };

    expect(extractTenantContexts(graph)).toEqual([]);
  });
});
