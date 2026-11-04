# Compact Chronology Puzzle at 150% Text Scale

## Status

Finalized. The independent human playtest remains deferred, and expanded content remains gated.

## Goal

Keep the Chronology Puzzle usable on compact viewports when the user's text scale is 150%, including access to every evidence-bearing event choice and the final Submit action.

## Scope

- Verify the puzzle at 320 × 400 and 390 × 400 with the app's text scale set to 150%.
- Keep the PuzzlePanel inside the viewport, with long evidence copy and all choices reachable through its own scrolling region.
- Preserve keyboard and pointer access to Close, each of the four event buttons, the result/status, and Submit.
- Complete the chronology and confirm the solved status/progression through the existing user flow.
- If the baseline reveals a defect, adjust only compact PuzzlePanel layout and scrolling rules.

## Constraints

- Preserve chronology event order, labels, evidence copy, puzzle rules, progression, and save shape.
- Preserve desktop presentation and the behavior of other panels.
- Do not expand content or treat automated layout coverage as a substitute for the deferred independent human playtest.

## Verification

The focused Playwright regression is `e2e/lab/chronology-puzzle-panel-layout.spec.js`, run with:

```powershell
npx playwright test e2e/lab/chronology-puzzle-panel-layout.spec.js --reporter=line --workers=1
```

It covers 320 × 400 and 390 × 400 at 150% text scale, viewport bounds and overflow, keyboard traversal, focus bounds and hit testing, evidence descriptions, selecting all events, Submit, and resulting status, stage, and progression.

The pre-implementation baseline had two tests: 320 × 400 failed because the first event card spanned y=127.02–305.52 while the panel's visible region spanned y=130.44–302.44, clipping the card at both ends; 390 × 400 passed. After the compact CSS changes, the focused regression passed 2/2. `npm run build` passed, and scoped review found no actionable findings. The full suite was not run.

## Execution record

At widths up to 360px, chronology cards stack in one column. At compact viewport heights from 360px through 439px, the puzzle panel extends to an 86px bottom inset to reserve toolbar space. The focused 320 × 400 and 390 × 400 regressions passed 2/2, including card/status reachability and puzzle solving. `npm run build` passed, and scoped review found no actionable findings. The independent human playtest remains deferred and content expansion stays gated.
