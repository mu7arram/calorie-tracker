# Calorie Tracker

A multi-language (English, Spanish, and RTL Arabic) single-page daily calorie and macronutrient tracker with Light, Dark, and System themes (radial View Transition reveal), Directional Silk Curtain + Layout Morph language transitions, no login required, Turso/libSQL persistence (with local SQLite file fallback), meal-category grouping, editable daily calorie goals, and three ways to add food (catalog quick add, Gemini AI text lookup, and Gemini AI meal photo analysis).

## Running the App

- **Requirements:** Node.js `>= 22.13.0`
- **Install dependencies:** `npm install`
- **Start dev server:** `npm run dev` -> open [http://localhost:3005](http://localhost:3005)
- **Run unit tests:** `npm test`
- **Production build:** `npm run build` and `npm start`
- **Lint:** `npm run lint`

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling & Typography:** Tailwind CSS v4 (`@tailwindcss/postcss`), `Bricolage Grotesque` + `DM Sans` + `IBM Plex Sans Arabic` (`next/font/google`)
- **Database:** Async libSQL via `@libsql/client` — connects to Turso (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`) on Vercel and defaults to local `file:data/calorie-tracker.db` in development
- **AI Nutrition Lookup:** Gemini REST API (`gemini-3.5-flash-lite`) via `GEMINI_API_KEY`
- **Tests:** Node built-in test runner (`node --import tsx --test`)

## Folder Structure

```text
.
├── .env                                          # Local secrets (GEMINI_API_KEY; gitignored)
├── .env.example                                  # Environment variable template
├── CLAUDE.md                                     # Project overview and quick reference
├── PLAN.md                                       # Summary of built features, improvements & roadmap
├── docs/
│   ├── 2026-11-17-initial-build.md               # Initial architecture & decision log
│   ├── 2026-11-20-gemini-nutrition-api.md        # Gemini text/image API decision log
│   ├── 2026-11-20-ai-frontend-integration.md     # Frontend AI tabs & batch log decision log
│   ├── 2026-11-20-design-polish-and-features.md  # Dark-mode redesign & audit loop log
│   ├── 2026-11-21-theme-switcher-view-transition.md # Light/Dark/System radial reveal log
│   ├── 2026-11-21-multilanguage-rtl-transitions.md  # EN/ES/AR RTL & silk curtain log
│   ├── 2026-11-24-vercel-turso-migration.md      # Async libSQL/Turso & Vercel migration log
│   ├── 2026-11-24-user-preferences.md            # Custom macro targets & units modal log
│   └── 2026-11-24-food-history-charts.md         # Multi-day navigation & 7D/30D charts log
├── data/                                         # Auto-created SQLite DB directory (gitignored)
└── src/
    ├── types/food.ts                             # Shared TypeScript types & MEAL_CATEGORIES
    ├── lib/
    │   ├── seed-foods.ts                         # 24 pre-seeded common foods (USDA macros)
    │   ├── i18n.ts                               # EN/ES/AR UI strings, catalog & date helpers
    │   ├── db.ts                                 # SQLite singleton, migrations, queries & settings
    │   ├── gemini.ts                             # Gemini 3.5 Flash-Lite client & locale prompts
    │   └── __tests__/                            # Unit tests (db + gemini + i18n)
    ├── components/
    │   ├── LocaleProvider.tsx                    # Locale context, RTL/LTR & View Transitions
    │   ├── LanguageToggle.tsx                    # Compact Globe switcher (EN / ES / عربي)
    │   ├── ThemeToggle.tsx                       # Light / Dark / System switcher + radial reveal
    │   ├── PreferencesModal.tsx                  # Native <dialog> for macro goals & units
    │   ├── DateNavigator.tsx                     # Multi-day date switcher & picker
    │   ├── HistoryCharts.tsx                     # 7D/30D calorie & stacked macro charts
    │   ├── CalorieSummary.tsx                    # Calorie & macro target progress bars
    │   ├── AddFoodPanel.tsx                      # Meal selector + 3-tab input switcher
    │   ├── FoodSearchCatalog.tsx                 # Multilingual search & quick-add list
    │   ├── AiTextLookup.tsx                      # Plain-text AI meal description input
    │   ├── AiPhotoLookup.tsx                     # Meal photo upload, preview & AI lookup
    │   ├── AiNutritionReview.tsx                 # Shared AI item checklist & confirmation UI
    │   └── DailyFoodLog.tsx                      # Meal-grouped card-style food entries
    └── app/
        ├── page.tsx                              # Single-page orchestrator + header & date
        ├── layout.tsx                            # Root layout, fonts, FOUC script & LocaleProvider
        ├── globals.css                           # light-dark() theme tokens & View Transition CSS
        └── api/
            ├── foods/route.ts                    # GET /api/foods
            ├── settings/route.ts                 # GET & PATCH /api/settings (daily calorie goal)
            ├── logs/
            │   ├── route.ts                      # GET & POST /api/logs (catalog or AI batch)
            │   ├── history/route.ts              # GET /api/logs/history (7D/30D aggregation)
            │   └── [id]/route.ts                 # DELETE /api/logs/[id]
            └── nutrition/
                ├── text/route.ts                 # POST /api/nutrition/text (locale-aware)
                └── image/route.ts                # POST /api/nutrition/image (locale-aware)
```

## Security & Conventions

- `GEMINI_API_KEY` in `.env` is used exclusively on the server in `src/lib/gemini.ts` via the `x-goog-api-key` header. Never prefix it with `NEXT_PUBLIC_` or expose it in client components.
- `loggedDate` (`YYYY-MM-DD`) is always computed in the browser's local timezone and validated on the server.
- AI-confirmed meals are saved into `food_logs` with `food_id = NULL` inside a single SQLite transaction (`addCustomFoodLogs`).

## Next Steps

1. **Barcode Scanning:** Add camera-based UPC/EAN barcode scanning (backed by Open Food Facts lookup) as a fourth logging method for packaged foods.
