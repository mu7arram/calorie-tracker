# 2026-11-25 — Barcode Scanning (Camera + Open Food Facts)

## What Changed

- **Open Food Facts Service & API (`src/lib/barcode.ts`, `src/app/api/nutrition/barcode/[code]/route.ts`):**
  - Added `hasValidGtinCheckDigit` and `normalizeBarcode` to strip whitespace/hyphens and validate GS1 Mod-10 check digits across EAN-8, UPC-A, EAN-13, and GTIN-14 barcodes.
  - Added `inferPer100Unit` and `parseOpenFoodFactsProduct` to extract brand + product name, prefer per-serving nutrition when both serving size and serving energy exist, explicitly parse volume (`mL`, `L`, `Liters`, `cl`, `dl`, `fl oz`) vs. mass (`g`, `kg`, `oz`, `lb`) units for `100 ml` vs. `100 g` fallback, convert kJ to kcal when needed, and return our standard `NutritionLookupResponse` shape.
  - Added a bounded in-memory TTL cache (`10m` hits, `2m` not-found misses) in `lookupBarcodeNutrition`.
  - Added `GET /api/nutrition/barcode/[code]` (`runtime = "nodejs"`, `dynamic = "force-dynamic"`) with per-IP sliding-window rate limiting (`30 req/min` -> `429`), `Cache-Control: private, max-age=300` on hits, and structured `400` / `404` / `502` / `500` error handling.
- **Camera & Manual Barcode Scanner (`src/components/BarcodeLookup.tsx`, `src/components/AddFoodPanel.tsx`):**
  - Added `Barcode` as a 4th tab inside `AddFoodPanel` (responsive `grid-cols-2 sm:grid-cols-4` tab bar).
  - Implemented live rear-camera scanning using the native `BarcodeDetector` API where available and lazy-loaded `@zxing/browser` fallback for Safari/Firefox, guarding callbacks with active/mounted/stream checks plus duplicate-detection suppression (`lastScannedCodeRef`) and cleanly stopping all media tracks on detection, close, or tab switch.
  - Added a manual numeric barcode input + lookup form and piped scanned/fetched products into `AiNutritionReview` for confirmation before saving to Turso/libSQL.
- **Localization & Tests (`src/lib/i18n.ts`, `src/lib/__tests__/barcode.test.ts`):**
  - Added complete English, Spanish, and RTL Arabic copy for camera states, prompts, and errors.
  - Expanded tests to cover GTIN check digits, malformed nutriments, mixed-case/volume units, unexpected payloads, partial serving/100g fields, TTL caching, and `GET` route `200`/`400`/`404`/`429`/`500`/`502` responses.

## Verification

- `npm test`: 27/27 unit tests passing.
- `npx tsc --noEmit`: 0 TypeScript errors.
- `npm run build`: Clean production Next.js build.
