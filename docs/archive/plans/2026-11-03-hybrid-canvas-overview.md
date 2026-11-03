# Plan: Hybrid Canvas Overview

**Status:** Complete. Implementation, focused regressions, serial benchmark, and code review are complete. This plan is archived at `docs/archive/plans/2026-11-03-hybrid-canvas-overview.md`. Keep `browser-scaling-playtest-gate.md` active for its outstanding human playthrough.

## Goal

Support thousands of laboratory entities without mounting a full interactive React card for every overview item. At close zoom, retain crisp DOM cards and the existing inspector controls; at distant or dense zoom, paint lightweight cards on canvas while keeping important selections directly accessible.

The original specification allows that not every world object needs full DOM controls at all times. This milestone implements that allowance while preserving stable entity identity and ordinary organizing behavior.

## Source boundaries and implementation contract

- Add pure policy module `src/game/world/renderPolicy.js` exporting `getRenderMode({ currentMode, scale, visibleCount })`, returning `overview` or `detail`.
- Use hysteresis exactly: enter `overview` when `scale <= 0.4` OR `visibleCount > 400`; leave only when `scale >= 0.5` AND `visibleCount <= 320`.
- Keep the canvas backing resolution at 0.5 pixels per world unit for overview drawing. Paint lightweight item-family shape, color, accent, and an invalid-placement marker that does not rely on color alone.
- Limit ordinary overview DOM overlays to 64. Add forced DOM overlays for unique selected, dragged, or keyboard-focused items on top of that budget, so those cards remain crisp and actionable.
- Keep the CSS-transformed world scene frame-batched. Canvas content and overlays must track the same scene transform without changing camera or save formats.
- Add `src/game/world/hitTest.js` exporting `getItemSpatialBounds(item)` and `hitTestTopmostItem(index, worldPoint)`. Use `getItemSpatialBounds(item)` to supply rotated workspace AABBs when building `SpatialIndex`, so the broad phase cannot miss rotated card corners. Then use the index for broad-phase hit-test candidates, an exact rotated-card test, and reverse stable painter order to select the visually topmost hit.
- Add a keyboard-accessible, paginated Item Finder with 25 results per page. Selecting a result reveals and focuses that item in crisp DOM detail and exposes the existing inspector actions.
- Preserve camera behavior, save schema, entity IDs and order, authored/generated content, placements, progression, autosave/recovery, and existing inspector semantics.

Expected implementation boundaries are `src/game/world/renderPolicy.js`, `src/game/world/hitTest.js`, `src/ui/WorldViewport.jsx`, an Item Finder component under `src/ui/`, and its styles. Keep persistence and content generation out of scope.

## Focused test plan

The Test Engineer's focused test contract uses `tests/unit/game-foundation/render-policy.test.mjs` and `tests/unit/game-foundation/hit-test.test.mjs`, plus cases in `performance/browser-scaling-regression.spec.js` (the performance config discovers this file only).

Focused commands:

~~~sh
node --test --test-isolation=none tests/unit/game-foundation/render-policy.test.mjs tests/unit/game-foundation/hit-test.test.mjs
npm run test:e2e:performance -- --workers=1 --timeout=20000 --grep "overview|Item Finder|detail-scale|low-zoom|cull a sparse view"
~~~

The planned browser cases are:

- `174/5,024 items: overview canvas covers all entities with family and invalid cues`
- `overview hysteresis promotes crisp detail cards and caps ordinary overlays`
- `low-zoom canvas hit testing selects and physically files a distant synthetic item`
- `keyboard Item Finder paginates and focuses a distant synthetic entity`
- `detail-scale pan/zoom/drag/cancel/save preserves exact ordered state`

- Unit-test the mode boundary and hysteresis: detail enters overview at scale 0.4 or 401 visible items; overview remains active at scale 0.49 or 321 items; it returns to detail at scale 0.5 with 320 or fewer visible items.
- Unit-test `getItemSpatialBounds(item)` for rotated workspace AABBs, including corner coverage; test broad-phase index use, exact rotated hit geometry, and reverse stable painter order when cards overlap.
- Browser-test overview at 174 and 5,024 items: `data-rendered-item-count` equals the full entity count, ordinary DOM overlays stay within the 64-item budget, and selected/dragged/focused cards receive forced overlays. Pair the count assertion with pixel sampling for visible canvas paint and family/invalid cues.
- Expose internal, test-only canvas diagnostics: `data-testid="world-overview-canvas"` and `data-rendered-item-count`. The count is the number of entities represented by overview rendering across the canvas and forced DOM overlays. Selected/dragged/focused items may be omitted from the canvas draw pass to avoid visual duplicates while still counting as represented. E2E must assert the count equals the full item count and pair that structural assertion with pixel sampling to verify visible canvas paint. These attributes are not user-facing UI.
- Browser-test normal detail behavior at scale 0.5 and the sparse calibration view: ordinary authored items remain crisp DOM controls, all eight calibration cards stay visible, and existing inspector actions work.
- Browser-test canvas topmost selection and verify selecting an item displays/focuses its crisp DOM detail. Exercise Item Finder by keyboard, check 25 results per page and accessible pagination, select an item, and use the existing inspector action.
- Exercise zoom across both thresholds in both directions; verify mode hysteresis prevents flicker and that pan, wheel anchoring, drag/drop, pointercancel/Escape, zoom readout, save/reload, exact ordered IDs, and placement remain correct.
- Preserve invalid-placement shape/marker cues and test at least one invalid item in overview without relying on color perception.
- Verify the full-world overview accounts for all entities through canvas representation plus forced DOM overlays; adapt prior all-DOM full-world assertions for overview mode. Preserve exact IDs/count/save assertions and sparse culling at normal scale.
- Adapt the serial benchmark's full-world readiness gate to require a visible overview Canvas whose represented count matches the save and no more than 64 ordinary DOM overlays. Record mounted DOM overlays and Canvas represented count as separate metrics; retain detail and sparse-view DOM checks.

Use the focused unit command and opt-in regression command above during implementation. Before considering the milestone complete, also run `npm run test:e2e:performance -- --workers=1` to retain the existing spatial/save regressions, then the serial `npm run test:perf` benchmark. Do not run the full suite without approval required by `AGENTS.md`.

Red baseline before implementation:

- Unit command: `node --test --test-isolation=none tests/unit/game-foundation/render-policy.test.mjs tests/unit/game-foundation/hit-test.test.mjs` ran **5 tests, 0 passed and 5 failed** because `src/game/world/renderPolicy.js` and `src/game/world/hitTest.js` are not present (`ERR_MODULE_NOT_FOUND`).
- Browser command: `npm run test:e2e:performance -- --workers=1 --timeout=20000 --grep "overview|Item Finder|detail-scale|low-zoom|cull a sparse view"` ran **7 tests: 1 passed and 6 failed**. The detail-scale preservation case passed. Expected failures were the missing overview canvas in the overview coverage, hysteresis, and low-zoom cases; the old all-DOM full-world assertions at 174 and 5,024; and the missing Find an item control.
- First serial benchmark attempt after implementation: `npm run test:perf` built successfully, then exposed a pre-hybrid readiness assertion that still required 174 DOM cards. The benchmark harness was updated to check full Canvas representation and report overlay and Canvas counts separately.
- These red baselines were captured before implementation. After implementation, the focused unit tests passed 5/5, the planned focused browser subset passed 7/7, and the complete opt-in performance regression passed 12/12 in 44.9 seconds. The production build and serial benchmark passed; Code Reviewer found no actionable issues.

## Performance gate

Run the same serial browser benchmark on the same host and compare matching 174- and 5,024-item views. The hybrid Canvas overview passed: full-world pan and wheel p95 were at most 2x their 174-item baselines, with no measured over-50 ms full-world intervals or long tasks. The full report, including readiness, overlay and Canvas coverage counts, trial values, and host/browser details, is `docs/performance/2026-11-03-hybrid-canvas-overview.md`. Keep it separate from the clustered baseline and prior distributed-fixture reports.

The frame-bounded retest failed this gate at 26.33x pan and 25.67x wheel p95 growth. That historical result is distinct from and must not be presented as the hybrid-rendering result.

## Exclusions and review

- Do not change save schema, entity identity/order, collection progression, placement/capacity rules, authored content, camera interaction, or accessibility semantics.
- Do not treat overview canvas drawing as a replacement for keyboard access: the Item Finder and forced DOM details provide a keyboard path to every item.
- Do not expand to more content until the same-host performance gate passes and the separate human playthrough in `browser-scaling-playtest-gate.md` is complete.

There is no dedicated performance, accessibility, or playtesting role. The Architect defined boundaries, JavaScript/React/CSS Developers implemented the feature, the Test Engineer added regressions, the Code Reviewer checked behavior and performance claims, and the Documentation Specialist recorded results. This implementation plan is complete; keep the separate human-playthrough plan active.
