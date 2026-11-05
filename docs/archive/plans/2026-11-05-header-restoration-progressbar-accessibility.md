# Plan: Expose Header Restoration as an Accessible Progress Bar

## Goal

Make restoration progress available to assistive technology at compact widths where the accompanying statistics are visually hidden.

## Scope and constraints

- In `src/app/App.jsx`, put progress semantics on the visible `.progress-dial`: `role="progressbar"`, `aria-label="Laboratory restoration"`, `aria-valuemin={0}`, `aria-valuemax={100}`, and `aria-valuenow={restoredPercent}`.
- Remove `aria-hidden` from `.progress-dial` and remove the `aria-label` from its generic `.header-progress` parent.
- Preserve the visual markup and all sibling statistics, layout, and progress calculation.
- Keep the active browser-scaling and human-playtest gate unchanged.

## Verification

- Add a focused compact-header E2E case in `e2e/lab/header-responsive-layout.spec.js`.
- At a compact viewport, assert the dial is exposed as a visible progressbar named **Laboratory restoration**, its minimum and maximum are 0 and 100, and its current value matches the displayed restored percentage. Retain existing sibling-stat and responsive layout coverage.
- Run the focused case and the header-responsive-layout spec; do not run the full test suite.

## Test plan

- Regression case: `compact header exposes laboratory restoration as an accessible progressbar` in `e2e/lab/header-responsive-layout.spec.js`.
- Baseline: failed as intended at 390x480 because `getByRole('progressbar', { name: 'Laboratory restoration' })` found no matching element.

## Result

- At 390x480 with nonzero restoration, the focused regression passed 1/1; `npx playwright test e2e/lab/header-responsive-layout.spec.js --reporter=line --workers=1` passed 22/22.
- The regression asserts the visible percentage matches `aria-valuenow`; scoped review confirmed the named 0–100 progressbar and sibling-stat preservation.
- `git diff --check -- src/app/App.jsx e2e/lab/header-responsive-layout.spec.js` exited 0 with expected LF-to-CRLF notices. The full suite was not run.
- The active playtest/content-expansion gate remains open.
