export const ACCOUNT_ACCESS_TOKEN_PURPOSE = 'account-access' as const;
export const ACCOUNT_ACCESS_TOKEN_TTL = '24h' as const;

const DURATION_UNIT_LABELS: Record<string, [string, string]> = {
  s: ['second', 'seconds'],
  m: ['minute', 'minutes'],
  h: ['hour', 'hours'],
  d: ['day', 'days'],
};

export function formatAccountAccessTokenExpiry(
  ttl: string = ACCOUNT_ACCESS_TOKEN_TTL,
): string {
  const match = ttl.match(/^(\d+)([smhd])$/);

  if (!match) {
    return ttl;
  }

  const value = Number(match[1]);
  const unitKey = match[2];
  const labels = DURATION_UNIT_LABELS[unitKey];

  if (!labels) {
    return ttl;
  }

  const [singular, plural] = labels;
  return `${value} ${value === 1 ? singular : plural}`;
}
