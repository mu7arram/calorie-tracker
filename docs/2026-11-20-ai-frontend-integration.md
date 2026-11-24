# Decision Log: Connecting Gemini AI Lookup to the Frontend (2026-11-20)

## Summary of What Changed

Connected the existing Gemini nutrition endpoints (`POST /api/nutrition/text` and `POST /api/nutrition/image`) to the Calorie Tracker UI so users now have three ways to add foods, all persisting in local SQLite (`data/calorie-tracker.db`):
- **Quick Add (`FoodSearchCatalog.tsx`)**: Preserved the instant client-side search and serving multiplier across the 24 common foods.
- **Describe Meal (`AiTextLookup.tsx`)**: Plain-English meal description input calling `POST /api/nutrition/text` with loading spinner and friendly error messages.
- **Upload Photo (`AiPhotoLookup.tsx`)**: Image upload/camera picker with instant client-side preview, file type/size validation, optional context notes, and multi-item AI analysis via `POST /api/nutrition/image`.
- **Shared AI Confirmation (`AiNutritionReview.tsx`)**: Checklist review card allowing users to inspect and toggle individual detected food items before saving them to the database.
- **Batch SQLite Persistence (`db.ts`, `POST /api/logs`)**: Added `addCustomFoodLogs` to insert AI-detected items atomically in one transaction (`food_id = NULL`).

---

## Technical Decisions & Alternatives Considered

### 1. Tabbed `AddFoodPanel` with Preserved Tab State
- **Decision:** Group the three input methods into an accessible tabbed card (`AddFoodPanel.tsx`) and hide inactive tabs with the HTML `hidden` attribute rather than unmounting them.
- **Alternatives Considered:** Rendering three stacked cards vertically or unmounting inactive tab panels on switch.
- **Rationale:** Keeping all three modes inside one left-column panel keeps the single-page layout uncluttered alongside `DailyFoodLog`, while keeping inactive tabs mounted preserves typed descriptions, uploaded photo previews, and pending AI results if the user switches tabs.

### 2. Review & Confirm Step Before Saving AI Estimates
- **Decision:** Render `AiNutritionReview` with per-item checkboxes and a live subtotal instead of auto-saving Gemini results directly into `food_logs`.
- **Alternatives Considered:** Immediately calling `POST /api/logs` as soon as Gemini responds.
- **Rationale:** Matches the requirement to show all identified items from a meal photo so the user can confirm before adding, prevents unwanted or misidentified items from polluting the daily log, and gives clear visual feedback on portion assumptions.

### 3. Atomic Batch Mode in `POST /api/logs`
- **Decision:** Extend `POST /api/logs` to accept `{ items: CustomFoodLogItem[], loggedDate }` alongside `{ foodId, servings, loggedDate }`, executing all inserts inside `BEGIN IMMEDIATE ... COMMIT` in `addCustomFoodLogs`.
- **Alternatives Considered:** Sending N sequential `POST /api/logs` requests from the browser or creating a separate `/api/logs/custom` endpoint.
- **Rationale:** One atomic transaction prevents partial meal saves on error, keeps the REST surface minimal (`POST /api/logs` remains the single mutation endpoint for logging food), and returns the authoritative `DailyLogResponse` in one round-trip.

### 4. Client-Side `URL.createObjectURL` Preview with Cleanup
- **Decision:** Generate the uploaded meal photo preview using `URL.createObjectURL(file)` inside `useEffect` and revoke it on file change or unmount.
- **Alternatives Considered:** Reading the file into a data URL via `FileReader.readAsDataURL` in client state.
- **Rationale:** `URL.createObjectURL` is synchronous, avoids keeping large base64 strings in React state, and explicitly prevents memory leaks via cleanup revocation.

