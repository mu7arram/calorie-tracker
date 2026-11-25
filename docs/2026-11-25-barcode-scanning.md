# 2026-11-25 — Barcode Scanning (Camera + Open Food Facts)

## What Changed

- **Open Food Facts Service & API (`src/lib/barcode.ts`, `src/app/api/nutrition/barcode/[code]/route.ts`):**
  - Added `normalizeBarcode` to strip whitespace/hyphens and validate 8–14 digit UPC/EAN/GTIN codes.
  - Added `parseOpenFoodFactsProduct` to extract brand + product name, prefer per-serving nutrition when both serving calories and serving size exist, fall back to per-100g/100ml values (converting kJ to kcal when needed), and return our standard `NutritionLookupResponse` shape.
  - Added `GET /api/nutrition/barcode/[code]` (`runtime = "nodejs"`, `dynamic = "force-dynamic"`) returning `400` on invalid barcodes, `404` when not found, `502` on upstream failure, and `200` on match.
- **Camera & Manual Barcode Scanner (`src/components/BarcodeLookup.tsx`, `src/components/AddFoodPanel.tsx`):**
  - Added `Barcode` as a 4th tab inside `AddFoodPanel` (responsive `grid-cols-2 sm:grid-cols-4` tab bar).
  - Implemented live rear-camera scanning using the native `BarcodeDetector` API where available and lazy-loaded `@zxing/browser` fallback for Safari/Firefox, cleanly stopping all media tracks on detection, close, or tab switch.
  - Added a manual numeric barcode input + lookup form and piped scanned/fetched products into `AiNutritionReview` for confirmation before saving to Turso/libSQL.
- **Localization & Tests (`src/lib/i18n.ts`, `src/lib/__tests__/barcode.test.ts`):**
  - Added complete English, Spanish, and RTL Arabic copy for camera states, prompts, and errors.
  - Added 4 unit tests verifying barcode normalization, per-serving preference, kJ→kcal conversion fallback, and missing product handling.

## Verification

- `npm test`: 24/24 unit tests passing.
- `npx tsc --noEmit`: 0 TypeScript errors.
- `npm run build`: Clean production Next.js build.
