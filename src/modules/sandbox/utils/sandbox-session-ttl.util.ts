/** Fixed sandbox visit length. Refresh cannot slide this ceiling. */
export const SANDBOX_SESSION_TTL_MS = 60 * 60 * 1000;

export function sandboxSessionExpiresAt(now = Date.now()): Date {
  return new Date(now + SANDBOX_SESSION_TTL_MS);
}
