# Plan: Chronology Puzzle Compact Layout at 320×360

**Status:** Complete. The compact 320×360 layout and solved-status visibility are covered at 150% text, while the existing 320×400 and 390×400 cases remain green. Scoped review found no actionable findings. No build or full suite was run. The independent human playtest and content-expansion gate remain open.

## Goal and boundary

Make the open Chronology Puzzle usable at 320×360 with 150% text. First extend `e2e/lab/chronology-puzzle-panel-layout.spec.js` to exercise the existing puzzle flow at that viewport. If the regression reveals a layout defect, adjust only the compact puzzle-open panel and toolbar selectors for 360–399px heights.

Preserve chronology copy and ordering, save/progression shape, desktop presentation, and the existing 400–439px behavior. This layout slice does not change puzzle rules or chapter content. The independent human playthrough and content-expansion gate remain open.

## Test plan

Extend the existing Playwright spec with a 320×360 case using its 150% text preference and chronology fixture. Verify:

- The panel bounds stay inside the viewport, with no horizontal overflow in the panel or page.
- The compact toolbar remains reachable and its controls have at least 10px clearance from the panel edge; each toolbar control is hit-testable at its center.
- Keyboard focus and center hit-testing reach Close, all four event choices with their evidence descriptions, Undo, Clear, and Submit.
- Selecting the solution and submitting displays the completion status, advances to the Chronology Wheel, and marks the puzzle solved.

### Baseline

The Test Specialist's initial 320×360 run found two failures. The panel spans y=129.44–274 while the toolbar spans y=260–350, so they overlap by 14px instead of meeting the required 10px clearance. Toolbar keyboard focus and center hit-testing pass. After solving, the completion status is not visible within the panel viewport. The existing 320×400 and 390×400 cases remain green. Use these findings to guide the compact layout correction while preserving the already passing viewport cases.

After the scoped compact layout correction, the completion regression passed. The toolbar now retains at least 10px clearance from the panel, and the solved completion status is visible within the panel viewport. Keyboard focus and center hit-testing remain passing.

Run only the focused regression:

```sh
npx playwright test e2e/lab/chronology-puzzle-panel-layout.spec.js --reporter=line --workers=1
```

Do not run the full test suite for this slice.

## Implementation and acceptance

If the new case fails because the compact open panel or toolbar is clipped or too close to the viewport edge, make the smallest CSS correction scoped to compact puzzle-open selectors at 360–399px. Retain the tested 320×400 and 390×400 layouts and all behavior outside this viewport range.

- [x] The 320×360, 150%-text regression verifies panel bounds, horizontal overflow, 10px panel/toolbar clearance, toolbar center hit-testing, keyboard reachability, event evidence, and successful solve/progression.
- [x] CSS changes are limited to compact puzzle-open panel/toolbar selectors for 360–399px.
- [x] The focused Playwright command passed 3/3 at 320×360, 320×400, and 390×400; review confirms chronology content/order, save/progression shape, desktop, and 400–439px behavior are preserved.
- [x] Relevant project documentation was updated and this plan was archived after implementation, review, and verification.

No production build or full test suite was run for this slice.

