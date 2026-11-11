import { describe, expect, it } from '@jest/globals';
import { announcementVisibilityWhere } from './announcement-visibility-where.util';

describe('announcementVisibilityWhere', () => {
  it('limits platform callers to tenantId-null announcements', () => {
    expect(announcementVisibilityWhere(null)).toEqual({ tenantId: null });
  });

  it('includes platform-wide and the caller tenant for members', () => {
    expect(announcementVisibilityWhere('tenant-a')).toEqual({
      OR: [{ tenantId: null }, { tenantId: 'tenant-a' }],
    });
  });
});
