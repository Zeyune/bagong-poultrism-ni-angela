import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";

// Next.js reads .env.local; Vitest does not load it on its own.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

export default defineConfig({
  test: {
    // Node, not jsdom: the centre of gravity is route handlers and database
    // invariants, not component rendering (docs/TESTING.md §1).
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.ts"],

    // Integration tests share one local Postgres. Running files in parallel
    // would let them see each other's uncommitted state and fail intermittently
    // — the worst kind of test failure, because it trains people to re-run.
    fileParallelism: false,

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // No global threshold, deliberately. The gate is scripts/check-coverage-map.mjs,
      // which asserts that RULES are covered by ID. A percentage is satisfiable
      // while withdrawal enforcement and the stock ledger go untested.
      exclude: ["**/*.config.*", "**/.next/**", "scripts/**", "prisma/**"],
    },
  },
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
});
