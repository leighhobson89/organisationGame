# Plan: Scroll the Compact Toolbar with Wheel Input

## Problem

The compact `.game-toolbar` is portaled into a sibling overlay, separate from the world viewport. Its wheel events do not reach the viewport handler. At 320 × 360, vertical wheel input over the rail does nothing, while horizontal trackpad `deltaX` already uses native scrolling.

## Scope and implementation

- Add a toolbar-local handler that maps nonzero vertical `deltaY` to horizontal `scrollLeft` when the rail overflows and can scroll in that direction.
- Prevent the default only when the toolbar can consume the vertical wheel input.
- Leave horizontal `deltaX` to the browser's existing native rail-scrolling behavior.
- Ignore wheel events targeting form controls, especially the World Jump `<select>`, so the rail handler does not interfere with native control behavior.
- At a rail edge, leave vertical input unconsumed and inert; it must not trigger world zoom.
- Preserve wheel and pinch behavior outside the toolbar and on non-compact layouts.

## Acceptance criteria

- At 320 × 360, vertical wheel input over an overflowing toolbar moves its horizontal scroll position and exposes off-screen controls.
- When vertical input scrolls the toolbar, the world transform and zoom announcement remain unchanged.
- Horizontal `deltaX` continues to scroll the rail natively.
- The vertical-wheel regression targets a noninteractive child such as `.zoom-readout`; wheel input over the World Jump `<select>` leaves the rail's `scrollLeft` unchanged and preserves native select wheel behavior.
- Vertical input at either rail edge leaves the toolbar position unchanged and does not zoom the world.
- Wheel and pinch interactions elsewhere, including desktop world navigation, retain their existing behavior.
- Keyboard and touch toolbar scrolling remain unchanged.

## Focused verification

- The regression is `wheel input over the compact toolbar scrolls its rail without moving the world at 320x360` in `e2e/lab/mobile-toolbar.spec.js`. It targets `.zoom-readout` for rail scrolling and verifies a wheel over World Jump does not move the rail.
- The red baseline showed vertical `deltaY` left `scrollLeft` at `0`. A review follow-up found that wheel input over World Jump shifted the toolbar by 120px, so the handler now ignores form-control targets. In configured Edge, a closed select does not cycle its options on wheel; the regression therefore checks rail position rather than option changes.
- Final focused command: `npm exec -- playwright test e2e/lab/mobile-toolbar.spec.js e2e/lab/zoom-announcements.spec.js --grep "wheel input over the compact toolbar|real wheel zoom keeps an empty off-center pointer anchored|small pixel wheel deltas zoom smoothly|horizontal trackpad movement pans" --workers=1 --reporter=line` passed 4/4. It verifies vertical rail scrolling, native horizontal `deltaX`, inert edge behavior, no world zoom or zoom announcement while scrolling, World Jump select isolation, and existing wheel/trackpad behavior outside the rail.
- After adding explicit noninteractive target assertions for the rail edge and World Jump select, the focused compact-toolbar wheel case passed 1/1.
- Vite 8.3.5 build passed with 62 modules. Scoped review found no actionable issues. The full suite was not run. The independent human playtest remains deferred and content expansion stays gated.

## Status

Complete. Focused E2E coverage, production build, documentation update, and scoped review are complete. Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-compact-toolbar-wheel-scroll.md`.
