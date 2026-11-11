import { describe, expect, it } from '@jest/globals';
import { PERMISSION_METADATA_KEY } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { BrandRequestsController } from './brand-requests.controller';

describe('BrandRequestsController permission metadata', () => {
  it('gates submit with platform:customer:brand-requests:create', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        BrandRequestsController.prototype.submit,
      ),
    ).toBe(PERMISSIONS.BRAND_REQUESTS.CREATE);
  });

  it('gates my-requests with platform:customer:brand-requests:self-read', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        BrandRequestsController.prototype.findMine,
      ),
    ).toBe(PERMISSIONS.BRAND_REQUESTS.SELF_READ);
  });

  it('gates update with platform:customer:brand-requests:self-update', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        BrandRequestsController.prototype.updateMine,
      ),
    ).toBe(PERMISSIONS.BRAND_REQUESTS.SELF_UPDATE);
  });

  it('gates cancel with platform:customer:brand-requests:self-cancel', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        BrandRequestsController.prototype.cancelMine,
      ),
    ).toBe(PERMISSIONS.BRAND_REQUESTS.SELF_CANCEL);
  });
});
