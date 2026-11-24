# Decision Log: Multi-Language Localization (EN / ES / AR) & Directional View Transitions (2026-11-21)

## Summary of What Was Added
Added full localization for **English (`en`)**, **Spanish (`es`)**, and **Arabic (`ar`, RTL)** across the entire app:
- **Zero-FOUC Persistence (`layout.tsx`, `LocaleProvider.tsx`)**: Defaults to English, persists choice in `localStorage` under `"locale"`, syncs `lang` and `dir` (`rtl` for Arabic) before first paint via an inline `<head>` script, and syncs across browser tabs via `storage` events.
- **Compact Globe Switcher (`LanguageToggle.tsx`)**: Placed beside `ThemeToggle` in the header (fixed `ThemeToggle` to a single header instance rather than separate mobile/desktop renders), opening an accessible menu with `English`, `Español`, and `العربية`.
- **Full Translation & Multilingual Catalog Search (`src/lib/i18n.ts`)**: Translated all UI labels, error/toast messages, dates (Western numerals `ar-u-nu-latn`), native Arabic nutrition units (`سعرة`, `غ`), and all 24 seeded common foods with search matching both canonical English and localized names.
- **Locale-Aware Gemini Endpoints (`src/lib/gemini.ts`, `/api/nutrition/text`, `/api/nutrition/image`)**: Instruct Gemini `gemini-3.5-flash-lite` to return meal summaries, food names, and serving sizes in the active language while keeping JSON schema keys canonical.
- **Directional Silk Curtain + Layout Morph (`globals.css`, `LocaleProvider.tsx`)**: Uses `document.startViewTransition` + `flushSync` to sweep a directional curtain in the new reading direction while smoothly morphing `[data-vt]` layout panels between LTR and RTL (`1000ms`, `cubic-bezier(0.4, 0, 0.2, 1)`), and applies a calm vertical blur-dissolve (`600ms`) when switching between English and Spanish (`prefers-reduced-motion` respected).

---

## Technical Decisions & Alternatives Considered

### 1. Client `LocaleProvider` + Typed Dictionary vs. URL-Prefix Next.js i18n Routing
- **Decision:** Keep the app single-URL (`/`), managing locale in `LocaleProvider` backed by a strongly typed `src/lib/i18n.ts` dictionary and a synchronous `<head>` pre-paint script.
- **Alternatives Considered:** Sub-path routing (`/en`, `/es`, `/ar`) with `next-intl`.
- **Rationale:** Matches the single-page architecture with zero server redirect overhead, enables seamless in-place `document.startViewTransition` animations across LTR ↔ RTL flips, and guarantees compile-time completeness across all UI strings and all 24 catalog foods.

### 2. Scoped View Transition Classes (`html.lang-transitioning` vs. `html.theme-transitioning`)
- **Decision:** Apply distinct root classes for theme switching (`theme-transitioning`) vs. language switching (`lang-transitioning` + `lang-to-rtl` / `lang-to-ltr` / `lang-same-dir`), and assign `view-transition-name` to panels only while `lang-transitioning` is active.
- **Rationale:** Prevents CSS collisions between the radial circular theme reveal and the directional RTL/LTR curtain morph, and avoids leftover `view-transition-name` stacking contexts when idle.
