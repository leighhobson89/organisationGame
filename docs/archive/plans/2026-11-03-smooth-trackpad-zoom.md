# Plan: Smooth Trackpad Zoom

**Status:** Complete. The wheel normalization and focused regression passed; the separate browser-scaling and human-playtest content gate remains open.

## Goal

Make vertical trackpad scrolling zoom in proportion to the scroll distance, so repeated small pixel-mode deltas do not apply a full mouse-wheel zoom step each time. Preserve existing wheel zoom behavior for conventional wheel events, cursor anchoring, zoom bounds, and settled zoom announcements.

## Evidence and scope

`useWorldViewportController.js` currently branches only on the sign of `deltaY` and applies a fixed 1.12 or 0.89 factor for every vertical wheel event. A burst of ten pixel-mode events with `deltaY: -2` therefore compounds into an unexpectedly large zoom.

Limit the behavior change to vertical `onWheel` zoom normalization. Account for `deltaMode` and delta magnitude while keeping a conventional 120-pixel wheel delta approximately equivalent to the current 12% zoom step. Preserve horizontal-only trackpad panning, cursor-anchored zoom, configured scale limits, and announcement debounce behavior.

## Regression and verification

At a 1280×720 viewport, emit ten pixel-mode `WheelEvent`s with `deltaY: -2` over an empty point. Assert that:

- Aggregate scale change stays below 5%.
- The world point under the cursor remains within 1 CSS pixel of its original screen position.
- Exactly one settled zoom announcement is produced and matches the final zoom readout.
- A standard 120-pixel wheel event ends within 0.001 of `cameraBefore.scale * 1.12`.

The pre-implementation focused run exercised 11 tests: 10 passed and the new low-amplitude regression failed as expected. Ten `-2` pixel-mode events produced an aggregate zoom ratio of 3.10584, exceeding the 1.05 upper bound. After delta-mode and magnitude normalization, the focused zoom-announcements spec passed 11/11. Its small-delta case confirms less than 5% aggregate scale change, cursor anchoring within 1 CSS pixel, and one settled announcement matching the final readout. The test waits for `expectOneSettledAnnouncement` before reading the final zoom, avoiding a timing race. A 120-pixel wheel event ends within 0.001 of `cameraBefore.scale * 1.12`. Horizontal-only panning, cursor anchoring, configured scale limits, and announcement debounce remain covered.

The focused `npm run test:e2e -- --workers=1 e2e/lab/zoom-announcements.spec.js` run passed 11/11. `npm run build` passed with Vite 8.3.5 (59 modules), and scoped Code Reviewer found no actionable findings. The full suite was not run. Preserve the existing browser-scaling report and deferred independent human playtest as separate content-expansion gates; this change does not close either gate.

## Acceptance criteria

- [x] The small-delta regression failed with the current sign-only zoom behavior and passed after normalization.
- [x] A 120-pixel vertical wheel event remains within 0.001 of the existing 1.12 zoom factor.
- [x] Horizontal-only panning, cursor anchoring, scale limits, and settled announcements retain their existing behavior.
- [x] Focused regression, production build, and scoped review pass; the full suite remains unrun.
- [x] Relevant documentation is updated and this finalized plan is archived.
