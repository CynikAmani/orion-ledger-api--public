import { describe, expect, it } from '@jest/globals';
import { PERMISSION_METADATA_KEY } from '../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';
import { TenantAuditLogsController } from './tenant-audit-logs.controller';

describe('TenantAuditLogsController permission metadata', () => {
  it('requires tenant:audit:read', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        TenantAuditLogsController.prototype.findAll,
      ),
    ).toBe(PERMISSIONS.TENANT.AUDIT_READ);
  });
});
