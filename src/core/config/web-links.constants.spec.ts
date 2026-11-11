import { describe, expect, it } from '@jest/globals';
import {
  buildAccountRecoveryUrl,
  buildAccountSetupUrl,
} from './web-links.constants';

describe('web link builders', () => {
  it('builds account setup URLs from the request origin, not env', () => {
    expect(
      buildAccountSetupUrl('http://localhost:5173/', 'jane.doe', 'tok+en'),
    ).toBe('http://localhost:5173/auth/account-setup/jane.doe?token=tok%2Ben');
  });

  it('builds account recovery URLs from the production origin', () => {
    expect(
      buildAccountRecoveryUrl('https://app.orionledger.com', 'jane.doe', 'abc'),
    ).toBe(
      'https://app.orionledger.com/auth/account-recovery/jane.doe?token=abc',
    );
  });
});
