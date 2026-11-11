import { normalizeOrigin } from './allowed-origins.util';

export const WEB_LINK_PATHS = {
  ACCOUNT_SETUP: '/auth/account-setup',
  ACCOUNT_RECOVERY: '/auth/account-recovery',
} as const;

function requireFrontendOrigin(origin: string): string {
  const normalized = normalizeOrigin(origin);

  if (!normalized) {
    throw new Error('Frontend origin must be a valid http(s) origin');
  }

  return normalized;
}

function buildAuthenticatedPath(
  origin: string,
  pathTemplate: string,
  userId: string,
  token: string,
): string {
  const baseUrl = requireFrontendOrigin(origin);
  const encodedUserId = encodeURIComponent(userId);
  const encodedToken = encodeURIComponent(token);

  return `${baseUrl}${pathTemplate}/${encodedUserId}?token=${encodedToken}`;
}

export function buildAccountSetupUrl(
  origin: string,
  userId: string,
  token: string,
): string {
  return buildAuthenticatedPath(
    origin,
    WEB_LINK_PATHS.ACCOUNT_SETUP,
    userId,
    token,
  );
}

export function buildAccountRecoveryUrl(
  origin: string,
  userId: string,
  token: string,
): string {
  return buildAuthenticatedPath(
    origin,
    WEB_LINK_PATHS.ACCOUNT_RECOVERY,
    userId,
    token,
  );
}

export const WEB_LINKS = {
  paths: WEB_LINK_PATHS,
  accountSetup: buildAccountSetupUrl,
  accountRecovery: buildAccountRecoveryUrl,
} as const;
