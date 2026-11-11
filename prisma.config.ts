import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI (db push, migrate, introspect) connects as ol_owner via DIRECT_URL.
 * NestJS runtime must keep using DATABASE_URL (ol_app) through PrismaService.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",

  datasource: {
    url: process.env.DIRECT_URL,
  },

  // Dev-only workflow: no migrations — sync via `prisma db push` / `npm run db:reset`.
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
