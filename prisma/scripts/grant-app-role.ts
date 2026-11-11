import 'dotenv/config';
import { Pool } from 'pg';
import { buildPgPoolConfig } from '../../src/core/database/build-pg-pool-config.util';

/**
 * After `prisma db push --force-reset`, ol_owner recreates public objects.
 * ol_app (DATABASE_URL) needs DML grants restored before seed / NestJS can run.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in environment`);
  }
  return value;
}

function connectionUser(databaseUrl: string): string {
  const parsed = new URL(databaseUrl.replace(/^postgresql:/i, 'http:'));
  return decodeURIComponent(parsed.username);
}

async function main(): Promise<void> {
  const directUrl = requireEnv('DIRECT_URL');
  const appRole = connectionUser(requireEnv('DATABASE_URL'));

  const pool = new Pool(buildPgPoolConfig(directUrl));

  try {
    await pool.query(`GRANT USAGE ON SCHEMA public TO "${appRole}"`);
    await pool.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${appRole}"`,
    );
    await pool.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${appRole}"`,
    );
    await pool.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${appRole}"`,
    );
    await pool.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${appRole}"`,
    );

    console.log(`Granted DML on public schema to ${appRole}`);
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error('Failed to grant application role privileges:', error);
  process.exit(1);
});
