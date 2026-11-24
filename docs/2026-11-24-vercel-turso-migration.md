# 2026-11-24 — Vercel Deployment & Turso (libSQL) Async Migration

## What Changed

- **Replaced `node:sqlite` with `@libsql/client` (`src/lib/db.ts`):**
  - Migrated all database operations (`initSchemaAndSeed`, `createDatabase`, `getDb`, `listFoods`, `getDailyCalorieGoal`, `setDailyCalorieGoal`, `getDailyLog`, `addFoodLog`, `addCustomFoodLogs`, `deleteFoodLog`) from synchronous `DatabaseSync` to async `@libsql/client`.
  - Reads `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (auto-injected by the Vercel Marketplace Turso integration) with fallback to `DATABASE_URL` / `DATABASE_AUTH_TOKEN`, and defaults to `file:data/calorie-tracker.db` when running locally with no remote DB configured.
  - Replaced manual `BEGIN IMMEDIATE` / `COMMIT` transactions with atomic `client.batch(..., "write")` for both initial food seeding and batch AI food logging.
  - Added a shared `globalThis.__calorieTrackerDbInit` initialization promise (reset on transient failure) so cold-start serverless invocations initialize schema and seed data once safely.
- **Updated API Routes (`src/app/api/foods/route.ts`, `logs/route.ts`, `logs/[id]/route.ts`, `settings/route.ts`):**
  - Awaited all async DB calls while preserving existing validation, HTTP status codes, and response shapes.
- **Cleaned Up `next.config.ts`:**
  - Removed the custom `webpack` `externals.push("node:sqlite")` hook now that `node:sqlite` is no longer imported.
- **Added `.env.example`:**
  - Documented `GEMINI_API_KEY`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN` using safe placeholder values.
- **Updated Unit Tests (`src/lib/__tests__/db.test.ts`):**
  - Converted all 7 database tests to `async/await` against isolated `:memory:` libSQL clients.

## Decisions Made & Why

- **Turso (`@libsql/client`) over Postgres:** Keeps our existing SQLite SQL syntax (`AUTOINCREMENT`, `INSERT OR IGNORE`, `ON CONFLICT(key) DO UPDATE`, `PRAGMA table_info`) intact, supports zero-config local file storage (`file:data/calorie-tracker.db`) and `:memory:` unit tests without Docker, and integrates natively with Vercel Marketplace.
- **Explicit row mapping:** Mapped `@libsql/client` `Row` values to typed plain JavaScript primitives (`Number`, `String`, `null`) so JSON serialization and strict equality assertions behave identically across local SQLite and remote Turso.

## Verification

- `npm test`: 14/14 unit tests passing (7 libSQL data layer, 4 Gemini service, 3 i18n).
- `npx tsc --noEmit`: 0 TypeScript errors.
- `npm run build`: Clean production Next.js build with 0 errors.
