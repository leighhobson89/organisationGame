# Item Finder at 360–439px

## Goal

Keep Item Finder controls and results readable, reachable, and operable at 150% text scale in compact 360–439px viewport heights.

## Scope

- Cover 320 × 360 and 667 × 375 viewports at 150% text scale, together with the failing 320 × 400 and 390 × 400 compact Finder cases. Treat these as one 360–439px compact Finder fix; retain 440px-and-up layout behavior.
- The current short-height Finder size cap is too small for its controls and results. Use the pinned-Finder treatment throughout 360–439px: pin the Finder shell at `top: 58px` and `bottom: 64px`, remove its `max-height` cap for this band, and use a 44px horizontal toolbar rail with 38px targets.
- Implement the responsive change in `src/styles/app.css` only.
- Account for Item Finder's portal placement: `.world-overlay-host` remains a DOM descendant inside `.game-main` despite `display: contents`, and Finder/stack positioning resolves against `.game-main`. Do not use `:has(> .world-item-finder)`; retain the existing portal behavior.
- Preserve layout at 440px and above, no-panel fresh-start behavior, save data and schema, and Finder semantics including search, filtering, announcements, pagination, and focus behavior.

## Implementation and Verification

- Add Finder-open styles at 360–439px and widths up to 720px without changing the no-panel fresh-start layout or 440px-and-up behavior. Resolve positioning against `.game-main` through the existing portal descendant structure.
- Focused E2E coverage in `e2e/lab/item-finder-layout.spec.js` covers 320 × 360, 667 × 375, 320 × 400, and 390 × 400 at 150% text.
- Verify Close and search remain visible; the Finder shell and results list scroll as intended; Finder stays inside viewport bounds and clears the toolbar; toolbar and Finder targets pass hit testing; and the complete keyboard path through search, results, Next, and page controls remains visible and operable.
- Run the focused Item Finder E2E spec and production build only. Do not run the full suite without user approval.

## Test Plan

The four compact Finder cases in `e2e/lab/item-finder-layout.spec.js` cover 320 × 360, 667 × 375, 320 × 400, and 390 × 400 at 150% text. They check shell/result scrolling, Close and search visibility, toolbar clearance and hit testing, and the full keyboard path through search, results, Next, and page controls.

Pre-implementation baseline: all four compact cases failed. At 320 × 360, autofocus scrolled the page to `scrollTop=147`, leaving a 20px Finder shell with Close and search outside it; the toolbar was 90px high without a horizontal rail. At 667 × 375, the toolbar was 93px high without a horizontal rail, search was outside the shell and overlapped the hint, and the Atlas toggle overlapped Close. At 320 × 400 and 390 × 400, toolbar controls failed center hit testing and the Finder overlapped the toolbar by 206.6px and 223.3px respectively. Diagnose and resolve the 360–439px cases while retaining intended behavior at 440px and above.

## Outcome

- `npm run test:e2e -- --workers=1 e2e/lab/item-finder-layout.spec.js` passed 6/6 across 320 × 360, 667 × 375, 320 × 400, and 390 × 400 at 150% text scale.
- The Vite production build passed with 59 modules after a process-access retry.
- Code Reviewer found no issues and confirmed the Finder and compact-header overrides are scoped to their intended height bands, while fresh-start no-panel and Inspector layouts remain separate.
- The full test suite was not run. The independent human playtest remains deferred and content expansion remains gated.

This finalized plan is archived at `docs/archive/plans/2026-11-04-item-finder-360px-accessibility.md`.
