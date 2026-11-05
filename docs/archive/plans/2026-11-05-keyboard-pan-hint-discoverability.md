# Plan: Show Keyboard-Pan Guidance on World Focus

## Problem

The world viewport's accessible name explains that arrow keys pan when the region is focused, and its key handler pans only while focused. The visible `.world-hint`, however, describes mouse or touch navigation and does not show an equivalent keyboard cue. Keyboard users may not discover that the world can be panned from the focused region.

## Scope and implementation

- Add a concise visible keyboard-pan cue only while the world region has keyboard-visible focus.
- Preserve the existing default hint text and existing mouse/touch pan and zoom guidance.
- Keep the hint out of pointer-only focus states and maintain compact hint bounds and spacing.
- Preserve ArrowRight camera behavior, keyboard focus behavior, camera persistence, and all other input handling.
- Do not add authored game content or change progression or save data.

## Acceptance criteria

- When keyboard navigation gives the world viewport keyboard-visible focus, the hint visibly explains that arrow keys pan the laboratory.
- Pressing ArrowRight while the world region is focused pans the camera as it does today.
- The keyboard cue is not shown in the default unfocused state or when focus is pointer-visible only.
- Existing mouse and touch guidance remains unchanged.
- At compact widths, the keyboard cue remains within the hint area and does not overlap the toolbar or other controls.
- No camera, selection, progression, or persistence behavior changes beyond the existing arrow-key pan.

## Focused verification

- Add a regression to `e2e/lab/world-input-guidance.spec.js` named `keyboard pan guidance appears when the world viewport is focused`.
- Focused command: `npx playwright test e2e/lab/world-input-guidance.spec.js --grep "keyboard pan guidance appears when the world viewport is focused"`.
- Red baseline: the test failed 1/1 because `.world-hint__keyboard-guidance` is absent before and after Tab focus. Tab traversal reaches the world viewport, `:focus-visible` is true, and ArrowRight changes the `.world-scene` transform.
- Compact hint bounds and toolbar non-overlap assertions are conditional on the cue existing; they will exercise after implementation.
- Run `npx playwright test e2e/lab/compact-start-framing.spec.js --workers=1 --reporter=line` to guard compact hint bounds.
- Run the existing focused world-keyboard panning guard in `e2e/lab/world-and-save-recovery.spec.js` to preserve the requirement that arrow keys pan only while the world region has focus.
- Run focused E2E checks, a production build, and scoped review. Do not run the full suite without user approval.

## Status

Complete. The keyboard cue appears while the world viewport has keyboard-visible focus, with the default hint and pointer/touch guidance preserved.

## Final verification

- `npx playwright test e2e/lab/world-input-guidance.spec.js --reporter=line --workers=1` passed 3/3, including the focused keyboard-pan cue regression.
- `npx playwright test e2e/lab/compact-start-framing.spec.js --reporter=line --workers=1` passed 22/22; compact hint bounds and toolbar clearance passed with the cue present.
- The existing `arrow keys pan only while the world viewport has focus` guard passed 1/1.
- `npm run build` passed with 62 modules. Scoped review found no actionable findings.
- The full suite was not run. The independent human playtest remains deferred and content expansion stays gated.
