# 2026-11-24 — Food History Charts & Multi-Day Navigation

## What Changed

- **Multi-Day History Data Layer & API (`src/types/food.ts`, `src/lib/db.ts`, `src/app/api/logs/history/route.ts`):**
  - Added `enumerateDateRange` and `getDailyHistory(fromDate, toDate)` in `src/lib/db.ts` using an indexed `GROUP BY logged_date` query on `food_logs` with zero-filled gap days and averages computed strictly over logged days.
  - Added `GET /api/logs/history` (`runtime = "nodejs"`, `dynamic = "force-dynamic"`) accepting `?endDate=YYYY-MM-DD&days=7|30` (1–90 days) or explicit `?from=...&to=...` bounds with strict validation.
- **Multi-Day Date Navigator (`src/components/DateNavigator.tsx`):**
  - Built a responsive date navigation bar with Previous/Next day arrows (RTL-mirrored via `rtl:rotate-180`), a `Today` badge & jump button, and a native `<input type="date">` capped at today's local date.
  - Wired `selectedDate` across `page.tsx` and `DailyFoodLog.tsx` so users can inspect, log, or delete entries for any past day, with dynamic date headings (`Meals for Nov 22`).
- **7-Day & 30-Day History Charts (`src/components/HistoryCharts.tsx`):**
  - Added an interactive **History & trends** card with `7 days` / `30 days` range toggle and `Calories` (status-colored bars vs. dashed daily goal line) / `Macros` (stacked Protein/Carbs/Fat bars) view modes.
  - Added a 5-tile summary strip (logged daily average energy, days logged, average Protein/Carbs/Fat) respecting the user's `kcal`/`kJ` and `g`/`oz` preferences.
  - Clicking or tapping any day bar navigates straight to that day's log; hovering/focusing displays an exact readout of calories, macros, and item count.
- **Localization & Tests (`src/lib/i18n.ts`, `src/lib/__tests__/db.test.ts`):**
  - Added EN / ES / AR strings plus `formatShortDate` and `formatWeekdayShort` (Western numerals in Arabic) and a unit test verifying multi-day aggregation, zero-filled gaps, and logged-day averages.

## Verification

- `npm test`: 20/20 unit tests passing.
- `npx tsc --noEmit`: 0 TypeScript errors.
- `npm run build`: Clean production Next.js build.

