import { describe, expect, it } from '@jest/globals';
import { PERMISSION_METADATA_KEY } from '../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';
import { PlatformAuditLogsController } from './platform-audit-logs.controller';

describe('PlatformAuditLogsController permission metadata', () => {
  it('requires platform:audit:read', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        PlatformAuditLogsController.prototype.findAll,
      ),
    ).toBe(PERMISSIONS.PLATFORM.AUDIT_READ);
  });
});
