# Decision Log: Light / Dark / System Theme Switcher & Radial Reveal (2026-11-21)

## Summary of What Was Added
Added full **Light**, **Dark**, and **System** theme support (`ThemeToggle.tsx`) with a smooth expanding circular View Transition (`clip-path: circle(...)` radiating from the clicked toggle button across the viewport), zero flash of unstyled/wrong theme on load, and semantic light/dark CSS color tokens across every component.

---

## Technical Decisions & Alternatives Considered

### 1. `<meta name="color-scheme">` + CSS `light-dark()` Tokens vs. `.dark` Class Toggle
- **Decision:** Follow modern `color-scheme: light dark` semantics by storing `"light"` or `"dark"` in `localStorage` (removing the key for `"system"`), reflecting it into `<meta name="color-scheme">` via a tiny synchronous `<head>` script before paint, and mapping `:root:has(> head > meta[name="color-scheme"][content="..."])` to `color-scheme` and `light-dark(...)` CSS custom properties (with `@media (prefers-color-scheme: dark)` fallbacks).
- **Alternatives Considered:** Applying a `.dark` class on `<html>` via JS only.
- **Rationale:** Built-in browser UI (`scrollbar-color`, `accent-color`, `<select>` popups, canvas background) adapts automatically without JS, FOUC is prevented via the blocking inline `<head>` script, and cross-tab updates sync cleanly via `window` `storage` events.

### 2. Three-State Toggle (`Light` / `Dark` / `System`) with Circular View Transition
- **Decision:** Render a compact 3-icon segmented radiogroup (`Light`, `Dark`, `System`) in the header, wrapping theme changes in `document.startViewTransition` + `flushSync` and animating `::view-transition-new(root)` with a `clip-path: circle(0px at x y)` -> `circle(endRadius at x y)` reveal (falling back to instant update when `prevEffective === nextEffective`, unsupported, or `prefers-reduced-motion: reduce`).
- **Alternatives Considered:** Simple CSS `transition: background-color` cross-fade or a 2-state toggle.
- **Rationale:** Matches the circular wipe UX demonstrated in the user's reference video, avoids repainting every element separately, keeps `System` explicitly reachable with live status (`"System (currently dark/light)"`), and strictly respects `prefers-reduced-motion`.

