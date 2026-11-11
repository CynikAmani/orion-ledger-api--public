import { describe, expect, it } from '@jest/globals';
import { buildManagedUserProfileAuditPayload } from './managed-user-update-notification.util';

describe('buildManagedUserProfileAuditPayload', () => {
  const current = {
    fullname: 'Ada',
    email: 'ada@old.test',
    phone: '111',
    nationalId: 'nid-1',
    genderId: 1,
    districtId: 2,
  };

  it('emits previous/current pairs only for values that actually changed', () => {
    expect(
      buildManagedUserProfileAuditPayload(current, {
        fullname: 'Ada Lovelace',
        email: 'ada@old.test',
        phone: '222',
      }),
    ).toEqual({
      previousFullname: 'Ada',
      fullname: 'Ada Lovelace',
      previousPhone: '111',
      phone: '222',
    });
  });
});
