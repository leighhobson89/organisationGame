# Plan: Item Finder at 150% Text Scale

**Status:** Complete. The compact Finder layout and portal layering passed focused and combined E2E coverage; final review found no remaining issues.

## Goal and boundary

Verify Item Finder remains readable and operable at 150% text scale on 320 × 480 and 390 × 480 viewports. Preserve search, result selection, pagination, announcements, nonmodal search semantics, focus restoration, and saved-game behavior. This polish slice does not add story content or close the independent human-playtest/content-expansion gate.

## Implementation outcome

- Added `e2e/lab/item-finder-layout.spec.js` cases for 320 × 480 and 390 × 480. The test seeds a fresh save and version-1 preferences at 150%; result counts and page counts derive from the fixture.
- Portaled ItemFinder alone into the existing `overlayRoot` at z-index 11. The Atlas toggle also portals there at z-index 12, above the z-index 10 toolbar/world hint and below side panels at z-index 20. The `.world-viewport` stacking order remains unchanged; the toggle retains its ref and inline fallback behavior.
- At short compact sizes, Finder starts below the Atlas toggle at `top: 58px` and uses `max-height: min(40%, calc(100% - 224px))` relative to `.game-main`, ending at least 10px above the visible toolbar. Its outer shell scrolls vertically, while the result list remains an independent scrollport with an 82px minimum height. Compact result-row typography and padding keep focused results usable.
- Preserved toolbar and world-jump visibility and hit testing, Atlas/Finder mutual exclusion and focus return, Finder's nonmodal `role="search"` semantics, and focus restoration when Finder closes or the viewport changes.

## Verification and review

- `npm run test:e2e -- --workers=1 e2e/lab/item-finder-layout.spec.js` passed **2/2**, covering both compact 150% viewports. Finder controls remain inside the panel; the result list scrolls independently; keyboard focus remains visible through the first and last results and Next page; Enter advances pagination. The test also verifies fixture-derived counts/pages, toolbar and world-jump hit testing, Atlas toggle clearance, and at least 10px toolbar clearance.
- Combined Finder announcements, Finder layout, panel-coordination, and World Atlas E2E coverage passed **38/38**. The Atlas/Finder interaction opens Atlas from the portal toggle, closes Finder, and restores focus when Atlas closes.
- Initial sandbox Playwright worker starts returned `EPERM`; the escalated focused and combined reruns executed and passed.
- Final code review found no remaining issues. Scoped `git diff --check` was clean aside from expected LF-to-CRLF notices. The full test suite was not run. The independent human-playtest/content-expansion gate remains open.

## Acceptance criteria

- [x] Both compact viewports apply 150% text scale; Finder controls fit without horizontal overflow, and its bottom clears the toolbar by at least 10px.
- [x] The outer Finder and inner results list scroll independently; required controls and results remain reachable.
- [x] Keyboard traversal reaches Close, the first and last result, and Next page with full focus bounds visible; Enter advances pagination.
- [x] Toolbar and world-jump remain visible and hit-testable; Atlas toggle layering and mutual exclusion work; focus restoration and nonmodal search semantics remain intact.
- [x] Search announcements and pagination behavior remain covered and unchanged.
- [x] No unrelated content, persistence format, or behavior changed; the human-playtest/content-expansion gate remains open.

## Archival

This finalized plan is preserved at `docs/archive/plans/2026-11-04-item-finder-150-percent.md`. The only remaining active plan in `docs/plans/` is the independent browser-scaling playtest gate.
