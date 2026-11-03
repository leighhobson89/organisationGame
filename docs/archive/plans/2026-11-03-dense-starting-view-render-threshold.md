# Plan: Dense Starting-View Render Threshold

**Status:** Complete. The dense 5,024-item starting view now uses the existing
Canvas overview, with focused verification and code review complete.

## Goal

Reduce camera interaction cost in the 5,024-item starting view by entering the
existing Canvas overview mode when culling finds more than 256 visible items.
Return to detail mode when the view has at most 192 visible items and scale is
at least 0.5. Keep the current 0.4 overview-entry scale boundary and Canvas
renderer behavior.

The 174-item starting view currently mounts 150 DOM cards and should remain in
detail mode. The 5,024-item starting view mounts 330 DOM cards and should use
Canvas plus the existing capped DOM overlay layer.

## Constraints

- Change only the visible-item hysteresis limits in
  `src/game/world/renderPolicy.js`; preserve the scale thresholds.
- Preserve overview hit testing and selection, including selected, dragged,
  and keyboard-focused DOM overlays and the 64 ordinary-overlay cap.
- Preserve the 174-item view, camera controls, culling, interactions, save
  schema, and all authored content.
- Add no entities, save fields, dependencies, or renderer behavior.
- Keep the independent human-playtest and content-expansion gate open.

## Verification scope

- `node --test --test-isolation=none tests/unit/game-foundation/render-policy.test.mjs`
  covers the 256/257 detail-to-overview boundary, the 192/193 overview-to-detail
  boundary, and the existing scale hysteresis boundaries.
- The serial benchmark asserts that the 174-item start remains detail-rendered
  and that the 5,024-item start uses Canvas for all entities with no more than
  64 DOM overlays. `npm run test:e2e:performance -- --workers=1` retains the
  174/5,024 overview selection, drag, pan, zoom, save/reload, Canvas hit-testing,
  and item-representation regressions.
- `npm run test:perf` builds the app and measures starting-view mounted-card
  counts, wheel frame p95s, intervals over 50 ms, and long tasks at 174, 500,
  1,000, 2,500, and 5,024 entities. Compare 5,024 with the same-host 174-item
  result and report individual trial variance.
- The focused unit baseline is red as expected: 1 passed and 2 failed at the
  new 256/192 boundaries against the current 400/320 policy. The benchmark
  assertions were added but not run pre-implementation; the existing report
  records the 5,024-item start in detail mode with 330 DOM cards.
- Do not run the full suite without user approval.

## Implementation and final results

The visible-item hysteresis limits are now 256 to enter overview and 192 to
return to detail. The existing 0.4/0.5 scale thresholds, Canvas hit testing,
forced selected/dragged/keyboard-focused cards, overlay cap, camera behavior,
and save data remain unchanged. The 174-item start remains in detail; the
5,024-item start paints all items on Canvas with 64 DOM overlays.

- Render-policy unit tests passed 3/3.
- Opt-in performance E2E passed 12/12.
- `npm run build` passed with Vite 8.3.5.
- `npm run test:perf` built and passed the serial benchmark 1/1 in 1.9 minutes.
  The post-change 5,024-item start view had wheel p95 of 16.8/16.7/16.8ms
  across three measured trials, with no interval or long task above 50ms.
- Code Reviewer found no actionable findings; `git diff --check` was clean.
- The full suite was not run. The independent human-playtest/content-expansion
  gate remains open. See `docs/performance/2026-11-03-dense-start-render-threshold.md`.
