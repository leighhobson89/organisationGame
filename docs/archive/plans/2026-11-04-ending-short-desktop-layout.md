# Restoration Ending: Short Desktop Layout

## Goal

Verify that the restoration ending remains readable and usable at a short desktop viewport with enlarged text. Fix the short-desktop ending CSS only if focused regression coverage exposes a layout problem.

## Scope and approach

1. Add a `1280×600` viewport case at `150%` text scale to `e2e/lab/full-restoration-ending.spec.js`.
2. Check that the dialog and its content stay within the viewport and do not overflow horizontally.
3. Check that the narrative, status, all six statistics, and Continue are visible and reachable by scrolling and keyboard navigation. Confirm Enter activates Continue.
4. If the baseline fails, adjust only the restoration-ending rules in `src/styles/app.css` for `max-height: 680px` and `min-width: 721px`. Preserve mobile and standard desktop layouts.

## Verification

- The new focused Playwright case passed 1/1 against the existing CSS.
- `npx playwright test e2e/lab/full-restoration-ending.spec.js --workers=1` passed 14/14.
- No runtime CSS change or build was needed. The scoped review found no actionable findings, and `git diff --check` reported only the expected LF-to-CRLF notice.

## Boundaries

- No story, content, or game behavior changes.
- The independent human playtest and content expansion remain gated as requested; this layout check does not open that gate.

## Test plan

- The test specialist added a `1280×600` / `150%` case to `e2e/lab/full-restoration-ending.spec.js`. It covers dialog and page bounds, scroll reachability for the narrative, status, six statistics, and Continue, keyboard focus and Enter activation, and horizontal overflow.
- The full focused ending spec passed **14/14**. No CSS adjustment was indicated; review and whitespace checks are complete.
