# 2026-11-24 — User Preferences (Custom Macro Targets & Display Units)

## What Changed

- **Extended Preferences Data Layer (`src/types/food.ts`, `src/lib/db.ts`, `src/app/api/settings/route.ts`):**
  - Expanded `UserSettings` to persist `dailyCalorieGoal` (`500–10,000` kcal), `proteinGoal` (`10–800` g), `carbsGoal` (`0–1,500` g), `fatGoal` (`10–400` g), `energyUnit` (`kcal` | `kj`), and `macroUnit` (`g` | `oz`) inside the `settings` table via atomic `client.batch(..., "write")` upserts.
  - Updated `GET /api/settings` to return the full `UserSettings` object and `PATCH /api/settings` to validate and apply partial updates while remaining backward-compatible with `{ dailyCalorieGoal }`.
- **Native Preferences Modal (`src/components/PreferencesModal.tsx`, `src/app/globals.css`):**
  - Built a responsive modal dialog using the native `<dialog>` element opened via `showModal()` with `closedby="any"` (plus a feature-detected pointerdown/pointerup light-dismiss fallback for Safari), `aria-labelledby` → `<h1>`, `autofocus`, and pure-CSS background scroll containment (`dialog:modal` + `dialog::backdrop` `overscroll-behavior: contain` with `overflow: hidden` on `::backdrop`).
  - Added a live macro-calorie preview (`P×4 + C×4 + F×9`), a non-blocking amber mismatch indicator when macro targets diverge from the calorie goal by `> 5%` (min 50 kcal), and a one-click **Auto-split 30/40/30** helper.
- **Unit-Aware & Goal-Aware UI (`CalorieSummary.tsx`, `DailyFoodLog.tsx`, `FoodSearchCatalog.tsx`, `AiNutritionReview.tsx`, `page.tsx`, `macro-sync.ts`):**
  - Upgraded the Protein, Carbs, and Fat cards in `CalorieSummary` to display consumed vs. daily target (`amount / goal`), individual progress bars, calorie-share percentages, and an inline amber out-of-sync banner with one-click proportional **Sync macros** (preserving the user's P/C/F ratio).
  - Added `formatEnergy`, `formatEnergyValue`, `getEnergyUnitLabel`, and `formatMacroAmount` in `src/lib/i18n.ts` with full English, Spanish, and RTL Arabic translations.
  - Added a header **Preferences** button next to `LanguageToggle` and `ThemeToggle`, plus a direct Preferences link in `CalorieSummary`.

## Verification

- `npm test`: 16/16 unit tests passing (including `getUserSettings`/`updateUserSettings` partial updates and `kcal`/`kJ`/`g`/`oz` localization helpers).
- `npx tsc --noEmit`: 0 TypeScript errors.
- `npm run build`: Clean production Next.js build.

