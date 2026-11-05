# Plan: Wrap the Desktop Progress Summary at 200% Text Scale

**Status:** Complete. At 200% text scale, the progress-summary rows now wrap only between 1051px and 1340px desktop widths.

## Goal and scope

At 200% text scale and viewport widths 1051–1340px, allow the header progress summary to wrap within its existing area so all text remains visible and unclipped. Keep the change limited to the progress summary's wrapping behavior at this scale and width range.

Likely implementation file: `src/styles/app.css`.

Do not change header widths, action layout, progress behavior or content. Preserve widths at or below 1050px, widths at or above 1341px, all other text scales, and compact 200% layouts.

## Implementation decisions

- Add a 200%-only desktop override for `.header-progress small` within the 1051–1340px breakpoint.
- Set `white-space: normal` and `overflow-wrap: anywhere` so long summary text can wrap without widening the header.
- Leave neighboring desktop header modes and compact rules unchanged.

## Acceptance criteria

- At 1280 × 720 with 200% text scale, every progress-summary line remains inside `.header-progress`, the header, and the viewport, with no clipping or horizontal overflow.
- Existing 100%, 125%, and 150% desktop header layouts remain unchanged.
- Compact 200% header layouts remain unchanged.
- Widths at or below 1050px and at or above 1341px retain their existing behavior.
- Header actions, progress values, and game behavior remain unchanged.

## Verification plan

- The Test Engineer added a focused 1280 × 720 / 200% test using a completed-game fixture and exact full progress-summary copy assertions.
- Reuse the shared header geometry checks and verify four visible progress-summary rows: each row's `scrollWidth` is no greater than its `clientWidth`, and every row remains within `.header-progress`, the header, and viewport bounds.
- Existing desktop 100%, 125%, and 150% and compact 200% header coverage guard the unaffected modes.
- Run the focused header-responsive E2E cases and a production build; do not run the full suite.
- Review the CSS media-query scope and ensure the wrapping override does not affect other scales or widths.

Focused command: `npx playwright test e2e/lab/header-responsive-layout.spec.js --grep "laboratory restoration summary stays complete and inside the header at 200% text" --reporter=line --workers=1`.

Red baseline: expected failure because summary text or shared header geometry overflows or clips at the target scale and viewport.

## Results

- Red baseline: the focused 1280 × 720 / 200% fixture exposed overflowing or clipped summary/header geometry.
- Added a 200%-only `.header-progress small` override at 1051–1340px with `white-space: normal` and `overflow-wrap: anywhere`. Other widths and scales retain their existing styles.
- The focused 1280 × 720 / 200% regression passed 1/1, and the complete `header-responsive-layout.spec.js` passed 23/23 (last-run status: passed).
- The Vite build passed with 61 modules. Scoped review found no actionable issues. Scoped `git diff --check` was clean aside from LF-to-CRLF notices. No full suite was run.
- Updated the Testing Guide and Roadmap. The independent human-playtest/content-expansion gate remains open.
