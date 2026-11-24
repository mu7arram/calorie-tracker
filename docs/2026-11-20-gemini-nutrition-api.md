# Decision Log: Gemini Nutrition Lookup API (2026-11-20)

## Summary of What Was Added

Added backend-only AI nutrition estimation endpoints powered by `gemini-3.5-flash-lite` (frontend left untouched):
- **Shared Gemini Client (`src/lib/gemini.ts`)**: Calls the Gemini REST API with `responseMimeType: "application/json"` and an explicit `responseSchema`, sanitizes negative/non-finite numbers, rounds to 1 decimal place, and computes server-side `totals` from `items`.
- **Text Lookup Route (`POST /api/nutrition/text`)**: Accepts `{ description: string }` (1–500 chars) and returns `{ summary, totals, items, model }`.
- **Image Lookup Route (`POST /api/nutrition/image`)**: Accepts `multipart/form-data` with an `image` file (`JPEG`, `PNG`, `WebP`, `GIF`, `HEIC`, `HEIF`, up to 10 MB) and optional `notes`, encodes it as base64 `inlineData`, and returns `{ summary, totals, items, model }`.
- **Unit Tests (`src/lib/__tests__/gemini.test.ts`)**: Tests payload normalization, negative-value sanitization, missing-key handling, and REST request formatting with a mocked `fetch`.

---

## Technical Decisions & Alternatives Considered

### 1. Direct Gemini REST `fetch` vs. `@google/genai` SDK
- **Decision:** Use Node's native `fetch` against `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent` with `x-goog-api-key`.
- **Alternatives Considered:** Installing `@google/genai` or LangChain.
- **Rationale:** Zero additional npm dependencies, full control over `responseSchema` structured output, trivial `fetch` dependency injection for unit tests, and passing `x-goog-api-key` in headers keeps the secret out of request URLs.

### 2. Returning `items[]` + Server-Computed `totals`
- **Decision:** Ask Gemini for a `summary` and an array of individual `items` (`name`, `servingSize`, `calories`, `protein`, `carbs`, `fat`), then compute `totals` on the server by summing `items`.
- **Alternatives Considered:** Asking Gemini for a single flat meal total.
- **Rationale:** Meals like `"grilled chicken with rice and salad"` or meal photos contain multiple foods; returning per-item breakdowns lets the upcoming UI show each component and log them individually or together, while server-side summation prevents LLM arithmetic drift.

### 3. `multipart/form-data` for Image Uploads
- **Decision:** Accept standard `multipart/form-data` (`FormData` `File`) in `POST /api/nutrition/image` rather than requiring clients to base64-encode JSON payloads.
- **Rationale:** Matches standard browser `<input type="file">` / `FormData` uploads, avoids ~33% JSON payload bloat over the wire, and enables clean MIME-type and 10 MB size validation before reading bytes.

