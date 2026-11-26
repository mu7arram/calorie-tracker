# Calorie Tracker — Project Plan & Architecture Overview

## What We Built
- **Single-Page Calorie & Macro Tracker (Next.js 15, TypeScript, Tailwind CSS v4):**
  - **Clean Header, Theme & Language Switchers:** Displays the app mark, title, localized date, live toast feedback, a Light / Dark / System switcher (`ThemeToggle.tsx`) using `color-scheme` + `light-dark()` tokens with an expanding radial circular View Transition reveal, and a Globe language menu (`LanguageToggle.tsx`) supporting English, Spanish, and RTL Arabic (`IBM Plex Sans Arabic`) with a Directional Silk Curtain + Layout Morph View Transition.
  - **Full Multi-Language Support (`en`, `es`, `ar`):** Translates all UI copy, dates, meal names, native units (`kcal`/`g`, `سعرة`/`غ`), all 24 common foods with cross-language search, and locale-aware Gemini AI meal & photo responses.
  - **Daily Calorie Goal & Progress Summary:** Tracks total calories vs. an editable daily goal (`500–10,000` kcal) with a green/yellow/red progress bar (`<= 85%` green, `86–100%` yellow, `> 100%` red) and a proportional Protein / Carbs / Fat visual breakdown.
  - **Three Ways to Log Food:**
    1. **Quick Add:** Instant client-side search across 24 USDA-seeded common foods with serving multipliers (`0.5×`–`3×`).
    2. **Describe Meal (Gemini AI Text):** Plain-English meal descriptions analyzed via `POST /api/nutrition/text` (`gemini-3.5-flash-lite`) with item-by-item review before saving.
    3. **Upload Photo (Gemini AI Vision):** Meal photo upload with instant preview, validation, optional notes, and multi-item detection via `POST /api/nutrition/image`.
  - **Meal-Grouped Daily Food Log:** Entries organized under `Breakfast`, `Lunch`, `Dinner`, and `Snack` as tactile cards with macro badges, meal calorie subtotals, and one-click removal.
  - **Turso / libSQL Persistence (`@libsql/client`):** Pre-seeded `foods`, denormalized `food_logs` snapshots (supporting both catalog entries and atomic batch AI logs), and `settings` stored in Turso on Vercel (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`) with automatic fallback to local `file:data/calorie-tracker.db` in development.

## What We Improved
- **AI Integration & Safe Review Flow:** Connected both Gemini endpoints to a unified tabbed panel with loading spinners, friendly error messages, and a selectable checklist confirmation step (`AiNutritionReview`) before writing to SQLite.
- **Design & UX Overhaul (3-Round Visual Audit):**
  - Upgraded to an intentional dark-mode aesthetic (`#111317` canvas, `#181B20` surfaces, `#34B37E` sage-emerald accent) with `Bricolage Grotesque` + `DM Sans` typography and `tabular-nums`.
  - Eliminated nested-card clutter in the food catalog, removed cliché all-caps eyebrows and middle-dot strings, and added skeleton loaders and actionable empty states.
  - Fixed responsive CSS Grid sizing (`grid-cols-1` + `min-w-0`) verified under true `390×844` mobile emulation with zero horizontal overflow.
- **Database Safety & Testing:** Added automatic `meal_category` schema migration for existing databases, strict server-side input validation, and unit test coverage across SQLite operations and Gemini normalization.

## Future Roadmap
1. ~~**Deploy to Vercel:**~~ *(Completed)* Migrated local `node:sqlite` to async `@libsql/client` (Turso) for serverless Vercel deployments.
2. ~~**User Preferences:**~~ *(Completed)* Added customizable daily Protein / Carbs / Fat targets, `kcal`/`kJ` and `g`/`oz` unit preferences, and a native `<dialog>` Preferences modal.
3. ~~**Food History Charts:**~~ *(Completed)* Added multi-day date navigation (`DateNavigator`) and interactive 7-day / 30-day calorie & stacked macro trend charts (`HistoryCharts` + `GET /api/logs/history`).
4. ~~**Barcode Scanning:**~~ *(Completed in `feat/barcode-scanning`)* Added camera-based (`BarcodeDetector` + `@zxing/browser` fallback) and manual UPC/EAN barcode scanning backed by Open Food Facts (`GET /api/nutrition/barcode/[code]`).

