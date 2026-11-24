# Decision Log: Initial Build (2026-11-17)

## Summary of What Was Built

Built a single-page Calorie Tracker web application from scratch at `http://localhost:3005` with:
- **Top Calorie & Macro Summary (`CalorieSummary.tsx`)**: Displays total calories (kcal), protein (g), carbs (g), fat (g), and item count for the current local date.
- **Instant Food Search & Quick-Add (`FoodSearchCatalog.tsx`)**: Loads 24 pre-seeded common foods (Chicken Breast, White Rice, Brown Rice, Whole Egg, Banana, Salmon, Oats, etc.) and filters instantly on the client with serving multipliers (`0.5x`–`3x`).
- **Daily Food Log (`DailyFoodLog.tsx`)**: Displays logged foods with scaled calories/macros and a remove button, backed by local SQLite persistence.
- **API & Persistence (`src/lib/db.ts`, `src/app/api/*`)**: Next.js Route Handlers backed by `data/calorie-tracker.db`.

---

## Technical Decisions & Alternatives Considered

### 1. Local SQLite via `node:sqlite` (`DatabaseSync`)
- **Decision:** Use Node.js 24's built-in `node:sqlite` module (`DatabaseSync`) with WAL mode (`PRAGMA journal_mode = WAL`), a `globalThis` singleton to survive HMR reloads, and `data/calorie-tracker.db` auto-created on first request.
- **Alternatives Considered:**
  - `better-sqlite3`: Mature, but requires native C++ compilation (`node-gyp`) during `npm install`.
  - Prisma / Drizzle ORM: Adds schema generation and migration overhead unnecessary for a two-table MVP.
  - `localStorage`: Zero backend setup, but data is tied to a single browser profile and cannot support future server-side AI/API features.
- **Trade-off:** `node:sqlite` emits an `ExperimentalWarning` in the Node console and requires Node `>= 22.13.0`.

### 2. Next.js Route Handlers (`nodejs` runtime + `force-dynamic`)
- **Decision:** Expose REST-style Route Handlers (`/api/foods`, `/api/logs`, `/api/logs/[id]`) with `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- **Alternatives Considered:**
  - Next.js Server Actions: Tightly couples mutations to React form transitions and makes `curl` / external API testing harder.
- **Rationale:** Explicit Route Handlers prevent static build-time caching of SQLite queries, provide clear HTTP status codes (`400`, `404`, `201`), and can be tested directly.

### 3. Denormalized Snapshot in `food_logs`
- **Decision:** Store `food_name`, `serving_size`, and scaled `calories`, `protein`, `carbs`, `fat` directly on each `food_logs` row (with `food_id` nullable via `ON DELETE SET NULL`), rounded to 1 decimal place (`Math.round(x * 10) / 10`) and summed in SQL via `ROUND(COALESCE(SUM(...), 0), 1)`.
- **Alternatives Considered:**
  - Joining `food_logs` to `foods` on every read.
- **Rationale:** Snapshotting guarantees historical log entries remain accurate even if catalog nutrition values are updated later, and prevents floating-point drift (e.g., `15.499999`).

### 4. Client-Derived Local Date (`YYYY-MM-DD`)
- **Decision:** Compute `loggedDate` on the client in local calendar time (`YYYY-MM-DD`) and validate it strictly on the server (`/^\d{4}-\d{2}-\d{2}$/`).
- **Alternatives Considered:**
  - Deriving `new Date().toISOString().slice(0, 10)` on the server.
- **Rationale:** Server UTC dates roll over to tomorrow at 21:00 in UTC+3, which would cause evening meals to disappear into the next day's log.

### 5. Client-Side Filtering of the 24-Food Catalog
- **Decision:** Fetch all 24 seeded foods once on mount from `GET /api/foods` and filter in-memory as the user types.
- **Alternatives Considered:**
  - Issuing a `GET /api/foods?q=...` request on every keystroke.
- **Rationale:** Instant zero-latency search for a small static catalog with no debouncing or extra network chatter.

### 6. Port `3005`
- **Decision:** Configure `npm run dev` and `npm start` to bind port `3005` (`next dev -p 3005`).

