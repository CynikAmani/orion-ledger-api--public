import type { PoolConfig } from 'pg';

/**
 * Prisma 7 + node-pg does not auto-bypass RDS TLS the way the old Rust engine did.
 * Without SSL, AWS RDS rejects with pg_hba "no encryption", which Prisma surfaces as
 * the misleading P1010 "User was denied access on the database".
 */
export function buildPgPoolConfig(databaseUrl: string): PoolConfig {
  const isRds = /rds\.amazonaws\.com/i.test(databaseUrl);
  const sslMode = new URL(databaseUrl).searchParams.get('sslmode');
  const wantsSsl =
    isRds ||
    sslMode === 'require' ||
    sslMode === 'verify-ca' ||
    sslMode === 'verify-full' ||
    sslMode === 'no-verify';

  return {
    connectionString: databaseUrl,
    ...(wantsSsl
      ? {
          ssl: {
            // Prefer a proper CA bundle in hardened envs; rejectUnauthorized:false
            // matches Prisma v7's documented RDS/workaround path.
            rejectUnauthorized:
              sslMode === 'verify-full' || sslMode === 'verify-ca',
          },
        }
      : {}),
  };
}
