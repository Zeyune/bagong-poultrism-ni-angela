// Prisma 7 moved connection configuration out of schema.prisma into this file.
// See docs/DATABASE.md § Supabase Integration.
//
// IMPORTANT — which URL goes where:
//   • This file's `datasource.url` is used by the Prisma CLI for migrations, so it
//     must be the DIRECT connection (port 5432). Migrations need session state that
//     Supabase's transaction-mode pooler does not preserve.
//   • The runtime client uses the POOLER (port 6543) via the driver adapter in
//     src/lib/db.ts. Serverless functions must not hold direct connections.
//
// Prisma 7 no longer loads .env automatically — hence the dotenv import.

// Next.js reads .env.local; dotenv defaults to .env. Load .env.local first so a
// single file serves both, then fall back to .env for anything not set there.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? "",
  },
});
