# Implementation Fix Summary v2

## Scope

This pass fixed the requested fatal issues and the major implementation gaps around API persistence, screenshot delivery, scraper behavior, preview UX, retargeting disclosure, rate limiting, and build/lint stability.

## Fatal Fixes

1. Canonical demo analysis IDs are now used consistently.
   - Updated `src/app/page.tsx` fallback navigation to use `demo_sonobello` / `demo_opendoor`.
   - Updated `src/lib/demo-data.ts` to use the same canonical IDs and screenshot URLs.

2. Screenshot delivery is now implemented.
   - Added `src/app/api/screenshot/route.ts`.
   - `GET /api/screenshot?id=...` now reads `screenshot:{id}` from KV and returns PNG bytes.
   - Missing screenshots return the required 1x1 transparent PNG placeholder.
   - `POST /api/analyze` now stores screenshots in KV for live analyses and demo payloads.

3. Vertex configuration no longer hardcodes project/location in the endpoint.
   - `src/lib/gemini.ts` now uses:
     - `process.env.VERTEX_AI_API_KEY || <demo fallback>`
     - `process.env.VERTEX_PROJECT || "focal-welder-485422-s2"`
     - `process.env.VERTEX_LOCATION || "us-central1"`

4. Demo payloads are now persisted.
   - `src/app/api/analyze/route.ts` stores demo responses in KV before returning.
   - `GET /api/analyze?aid=...` now checks KV first, including demo IDs.

## Major Fixes

1. Live journey crawling now follows the primary CTA even when step 1 already has fields.
   - Removed the step-1-field gate in `src/lib/analyze-page.ts`.
   - Kept the total scraper budget capped at 6 seconds.

2. Scrape timing was aligned with the requested budgets.
   - Navigation timeout: 3000ms.
   - Screenshot timeout: 2000ms.
   - Added shared remaining-budget checks so the scraper still aborts within the 6s total window.

3. Better scraper fallback classification.
   - Added basic bot/block detection in `src/lib/analyze-page.ts`.
   - Added `NO_FORM_DETECTED` propagation.
   - Added API error mapping for `NO_FORM_DETECTED`, `SCRAPING_BLOCKED`, `PAGE_NOT_FOUND`, `PRIMARY_FORM_UNCERTAIN`, and `LLM_ERROR`.

4. Preview UX now matches the review requirements more closely.
   - Added the 3-tab shell in `src/app/preview/page.tsx`:
     - `Field Detection`
     - `AI Copy`
     - `Performance`
   - Added editable extracted-field rows with modal validation/save/cancel behavior.
   - Added screenshot zoom controls.
   - Added copy regeneration UI backed by a new `POST /api/generate` route.

5. Retargeting disclosure is now always shown.
   - `src/app/bonus/page.tsx` now always renders the `SIMULATED DEMO DATA` banner.
   - Added the requested explanatory comment.

6. Typography regression was removed.
   - Deleted the Arial override in `src/app/globals.css`.
   - Preserved font variables from layout.

7. Added the missing `/analyze` page.
   - Created `src/app/analyze/page.tsx` with loading/progress/error/fallback handling for the documented route contract.

8. Added KV-backed rate limiting utilities.
   - New `src/lib/rate-limit.ts`.
   - `POST /api/analyze` and `POST /api/generate` now emit rate-limit headers and return `429 RATE_LIMITED` when exceeded.
   - `FORCE_DEMO_MODE` and `RATE_LIMIT_EXEMPT_IPS` are honored in the API layer.

9. Lint issues were fixed and build stability improved.
   - Fixed JSX entity escaping issues.
   - Switched the build script to `next build --webpack` because Turbopack was failing in this environment with a sandbox-related worker/process error.
   - Switched layout font loading to local bundled Geist font files so builds do not depend on network access.

## Verification

- `npm run build` ✅
- `npm run lint` ✅
