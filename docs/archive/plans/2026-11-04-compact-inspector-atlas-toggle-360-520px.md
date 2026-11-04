# Compact Inspector and Atlas Toggle Access at 360–520px Heights

## Goal

Keep a long-clue Inspector and the world toolbar readable, reachable, and operable at 320 × 360 and 390 × 360 with 150% text scaling, and keep the Atlas toggle accessible beside toolbar controls at 400–520px viewport heights.

## Scope

- Prevent Inspector and toolbar overlap while preserving a usable, scrollable Inspector details area.
- Keep Inspector Close, destination selector, Move, Focus, and toolbar controls inside the viewport, keyboard-reachable, and hit-testable.
- Inspector-specific placement rules currently begin at 400px, while generic max-height styles and narrow toolbar rules already apply at 360px. Extend the necessary Inspector layout behavior to 320 × 360 and 390 × 360 without changing those shared rules outside these cases.
- At 400–479px viewport heights, reserve a 64px lane for the visible, focusable Atlas toggle in the toolbar scroll-row layout; at 480–520px heights, reserve the same lane in the toolbar grid layout so the toggle does not overlap toolbar controls.
- Preserve existing Inspector geometry and touch/group behavior while making the Atlas toggle lane available. Preserve 400px+ behavior outside this targeted lane, including 320 × 400, 320 × 440, 390 × 440, 320 × 480, and 390 × 480 Inspector layouts; preserve desktop, fresh-start, and no-panel behavior.
- Keep selection behavior, save data, and schema unchanged.

## Implementation and Verification

- Add the minimum responsive CSS in `src/styles/app.css` for the 320 × 360 and 390 × 360, 150% long-clue Inspector states and the Atlas toggle lane at 400–520px viewport heights in both toolbar layouts.
- Extend focused regressions in `e2e/lab/inspector-panel-layout.spec.js` to cover the 360px Inspector cases and the existing 400–520px Inspector/Atlas toggle interactions.
- Verify the Inspector and toolbar do not overlap; the details area scrolls; Close, destination, Move, and Focus remain fully in-viewport, keyboard-reachable, and hit-testable; toolbar controls remain in-viewport, keyboard-reachable, and hit-testable; and the Atlas toggle remains visible/focusable without covering toolbar controls in the 400–520px scroll-row and grid states.
- Run the complete focused `inspector-panel-layout.spec.js` and `world-atlas.spec.js`, the production build, and scoped code review. Do not run the full suite without user approval.
- Retain existing viewport, desktop, fresh-start, and no-panel coverage to protect the preservation boundaries.

## Test Plan

The parameterized 150% text regression in `e2e/lab/inspector-panel-layout.spec.js` covers both 320 × 360 and 390 × 360. It checks Inspector/toolbar overlap and the scrollable details area, then verifies keyboard reachability and hit testing for Close, destination, Move, Focus, and toolbar controls. Existing Inspector cases at 400–520px viewport heights also cover the Atlas toggle and toolbar layout: the toggle must remain visible and focusable, with its 64px lane reserved in both the 400–479px scroll-row and 480–520px grid layouts, without obscuring toolbar controls.

Current Atlas-toggle baseline after the 360px CSS change: the two new 320 × 360 and 390 × 360 cases pass, while the full Inspector spec is 6 passed and 11 failed. All 11 failures share the Atlas-toggle overlay defect: ten Zoom-out center hit-test failures and one 390 × 440 click timeout. Preserve existing Inspector geometry and touch/group behavior while resolving the toggle lane. The original 360px red baseline was: both short-height cases failed first at the no-overlap assertion. At 320 × 360, the Inspector panel spanned y=119.44–294px and the toolbar y=260–350px, producing a 34px overlap; the details area was 0px high with `scrollHeight=1609px`, and the panel bottom inset was 66px. At 390 × 360, the panel spanned y=102.66–294px and the toolbar y=214–350px, producing an 80px overlap; the details area was 0px high with `scrollHeight=1302px`, and the panel bottom inset was 66px. Preserve all other viewport, desktop, fresh-start, and no-panel behavior.

## Outcome

The focused Inspector spec passed 17/17 and `world-atlas.spec.js` passed 15/15. The production build passed, and scoped Code Reviewer found no actionable findings. The full suite was not run. Independent human playtesting remains deferred and content expansion stays gated.
