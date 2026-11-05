# Plan: Workshop Skills at 200% Text Scale

**Status:** Complete. The compact 200% Skills layout and focused regression passed review.

## Goal and rationale

Verify the Workshop Skills panel remains usable at 200% text scale in the worst-case compact 320 by 360 viewport. Extend the existing 150% keyboard-visibility coverage with one scale/viewport case, reusing the five-point seeded game and panel geometry helpers.

## Scope and constraints

- Use the existing `seedGame(page, { textScale: 2 })` fixture, which provides five skill points, in a single 320 by 360 case.
- Verify text scale 2 is applied; the panel remains within viewport bounds with no panel/page horizontal overflow; the panel leaves at least 8px above the toolbar; and panel content scrolls internally.
- Traverse the purchase actions by keyboard and verify focus visibility inside the panel and viewport plus center hit-testing. Verify purchase actions remain enabled with their current accessible names.
- Verify existing visible disabled activation actions, installed/status messages, and selection hints remain visible at 200% within their skill cards.
- Preserve purchase costs, eligibility and activation semantics, all skill data and text, and the six existing 150% cases. Make production styling changes only if the focused regression demonstrates a layout defect; scope any change to the compact Skills surface.
- Run only the focused Skills spec; do not run the full suite. Keep the independent human-playtest/content-expansion gate unchanged.

## Implementation approach

1. Add one 200%/320 by 360 regression to `e2e/lab/skills-panel-layout.spec.js`, reusing `seedGame`, `expectFocusedActionVisible`, and panel geometry helpers.
2. Assert scale, panel/toolbar geometry, overflow, scrolling, keyboard focus visibility and hit-testing for each purchase action, and visibility of disabled activation/status/hint content.
3. Add `.skills-panel` to the existing 200%-compact header selectors to provide the required panel space, preserving the existing six 150% cases and purchase behavior.
4. Run only the focused Skills spec, complete scoped review, update relevant documentation, and archive the finalized plan.

## Test plan

The Test Engineer added `200% text scale keeps skill purchases and feedback reachable at 320x360` in `e2e/lab/skills-panel-layout.spec.js`. It uses `seedGame(page, { textScale: 2 })` and checks applied scale, panel/page bounds and overflow, internal scrolling, compact toolbar clearance and header geometry, keyboard visibility/hit-testing for purchase actions, and visible disabled activation, status, and hint content after purchases.

Focused command: `npx playwright test e2e/lab/skills-panel-layout.spec.js --grep "200% text scale keeps skill purchases and feedback reachable at 320x360"`.

Baseline result: **1 failed.** The scale, panel bounds, horizontal overflow, toolbar-gap, and heading checks passed before the assertion that the insight-points badge fit within the visible panel client bounds failed. No production or CSS edits had been made for the baseline.

The focused case was corrected to reach the Skills control by keyboard from Notebook; a direct-focus debug attempt had scrolled Instruments offscreen and did not represent the user's navigation path. After `.skills-panel` was added to the existing 200%-compact header selectors, the focused 200% case passed 1/1 in 3.7 seconds. The exact full-spec command, `npx playwright test e2e/lab/skills-panel-layout.spec.js --reporter=line --workers=1`, passed 9/9 in 20.7 seconds, including the six existing 150% cases and the new 200% case. Purchase semantics did not change. Scoped Code Reviewer found no actionable findings. No full suite was run.

## Acceptance criteria

- [x] The 200% text scale is applied to the seeded five-point game at 320 by 360.
- [x] The Skills panel stays within the viewport, the page and panel have no horizontal overflow, panel content scrolls internally, and the panel clears the toolbar by at least 8px.
- [x] Keyboard traversal reaches every purchase action with focus visible inside the panel and viewport and center hit-testing successful; purchase actions retain their existing enabled state and accessible names.
- [x] Disabled activation controls, installed/status content, and skill-selection hints remain visible at 200%.
- [x] Skill purchase, eligibility, and activation behavior remain unchanged; all six 150% cases are preserved; the human-playtest/content-expansion gate remains open.
- [x] The focused Skills spec passes, relevant documentation is updated, and the finalized plan is archived.
