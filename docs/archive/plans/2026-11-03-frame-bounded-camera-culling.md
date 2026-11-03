# Plan: Frame-Bounded Camera Motion and Culling

**Status:** Completed and reviewed; archived 2026-11-03. The implementation and focused checks are complete, but the full-world performance gate failed and content expansion remains NO-GO. The separate browser scaling/playtest gate remains active for the independent human playthrough.

## Goal

Keep pan and wheel input responsive on large worlds by limiting React and spatial-culling updates while preserving immediate camera motion, accurate interactions, and final persisted camera state. The serialization milestone is complete; current content scaling remains NO-GO because full-world interaction costs are high.

## Evidence and boundaries

The post-serialization distributed-fixture run reported 174-to-5,024 start readiness of 448.3-to-534.7 ms with mounted occupancy dropping from 150/174 to 330/5,024. Full-world readiness was 204.7-to-2,633.1 ms, with every item mounted. At 5,024, full-world pan/wheel p95 intervals were 1,266.7/850 ms; 90%/67% of intervals exceeded 50 ms and the actions recorded 23/1 long tasks. The frame-bounded camera retest is recorded separately in `docs/performance/2026-11-03-frame-bounded-camera-culling.md`; the original clustered baseline and post-serialization run remain in their own reports.

Likely implementation boundaries are `src/ui/WorldViewport.jsx`, `src/game/world/camera.js`, and the existing `src/game/world/spatialIndex.js`. Keep the current save schema, deterministic content, slot/capacity rules, autosave worker, and storage recovery behavior unchanged. Do not broaden this increment into a general renderer rewrite or content expansion.

## Implementation scope

- Apply the pan/zoom scene transform directly at most once per animation frame; avoid scheduling `setLiveCamera` React state updates for every input sample.
- Keep a current interaction-camera reference for pointer-to-world conversion, hit-testing, drag/drop, pan, zoom-anchor calculations, and gesture cancellation. Do not let a delayed culling snapshot make hit tests use stale coordinates.
- Separate the interaction camera from the rendered-item/culling snapshot. Refresh the snapshot when its overscanned viewport boundary is crossed and at interaction settle, using overscan hysteresis to avoid updates for sub-boundary camera motion.
- Commit the settled camera through the existing persistence path after pan/wheel input settles. Keep the transform visually current during the gesture and make the zoom readout catch up by settle.
- Preserve pointercancel and Escape cancellation semantics: cancel restores the starting camera transform and camera state instead of committing the partial gesture.
- Keep spatial culling correct at overscan boundaries and at the final camera. A sparse camera must still show its calibration items; a full-world camera must still mount every item.
- Add an internal-only `data-culling-revision` value to `[data-testid=world-viewport]` that increments when the culling snapshot refreshes. This diagnostic is for a focused regression, not a user-facing feature or a global React render counter.

## Preserved behavior

- Pan transforms update during pointer movement; wheel zoom remains anchored under the pointer.
- Pointer conversion, object hit-testing, dragging and filing, keyboard navigation, zoom limits/readout, Escape/pointercancel behavior, and final camera persistence remain correct.
- An external camera prop update during a pan cancels or rebases the gesture so later pointer events or Escape cannot restore or persist the stale pre-update camera.
- Exact item counts and ordered IDs, existing save/recovery formats, authored placements, and successful drag/autosave behavior remain unchanged.
- Existing accessibility and focus semantics remain intact.

## Focused test plan

The Test Engineer added the focused browser regression in `performance/browser-scaling-regression.spec.js` before implementation:

- Case: `5,024 items: pan and wheel use frame-bounded culling with settled camera commits`.
- Focused command: `npm run test:e2e:performance -- --workers=1 --grep "5,024 items: pan and wheel use frame-bounded culling with settled camera commits"`.
- Install the existing distributed 5,024-item fixture at the populated sparse camera and inspect `[data-testid=world-viewport][data-culling-revision]`.
- During a batch of sub-overscan pan moves, assert `.world-scene` transforms before pointerup while the culling revision delta remains at most one. After settle, require a culling refresh and verify the persisted camera matches the final transform.
- Send pointercancel and verify the starting scene transform and camera state are restored.
- During a pan, import a valid v3 save with a new camera prop, then end the gesture by pointerup or Escape. The imported camera must supersede the stale gesture; neither termination path may restore or persist the captured pre-import camera. Verify the imported camera and unchanged IDs in live state and autosave.
- Case: `5,024 items: camera imported near the wheel settle deadline stays live and saved`.
- Focused command: `npm run test:e2e:performance -- --workers=1 --grep "camera imported near the wheel settle deadline stays live and saved"`.
- Start a wheel gesture, then import a valid v3 save with a new camera at 179 ms, just before the 180 ms wheel-settle timer. Verify stale wheel work is cancelled and that the live and autosaved camera still match the imported save with its IDs unchanged after the old timer would have fired.
- During ten coalesced wheel events, assert the world point under the cursor stays anchored, the scene transform updates during the burst, the zoom readout catches up, and culling revisions remain bounded. After settle, verify the autosaved camera matches the final interaction camera.
- After the camera interactions, verify the eight calibration IDs remain mounted; complete a real drag/autosave and recheck the exact ordered IDs/count and filed placement.
- Retain the existing 174/5,024 culling, sparse-item visibility, full-world count, pan/zoom, and save/drag regressions. Do not add a global render-count hook; `data-culling-revision` measures only culling snapshot refreshes.

Red baselines before implementation:

- The focused frame-bounded pan/wheel case reported **1 failure** because `[data-testid=world-viewport]` had no `data-culling-revision` attribute (`Received: null`). The initial sandbox worker spawn returned `EPERM`; an elevated focused rerun established the expected red result.
- The two external-camera import variants reported **2/2 failures**: imported camera `panX: -910` was replaced with the stale pan start `-1800` after pointerup and after Escape.

Post-implementation verification:

- `npm run build`: passed.
- `npm run test:e2e:performance -- --workers=1`: complete opt-in regression group **7/7 passed in 32.2 seconds**, including the frame-bounded pan/wheel case, external-camera pointerup/Escape imports, and near-wheel import race.
- `npm run test:perf`: build and benchmark passed **1/1 in 4.7 minutes**; the performance gate failed as described below.
- Code review: clear; no remaining blocker.
- The full test suite was not run.

The focused spec is opt-in and stays outside default E2E discovery. Do not run the full suite without approval required by `AGENTS.md`.

## Performance gate

The same-host unprofiled benchmark was run after implementation. Start readiness was 447.8/528.5 ms at 174/5,024 with starting mounts of 150/174 and 330/5,024. Sparse readiness was 154.5/199.7 ms with eight mounted at each size; full-world readiness was 206.5/2,683.2 ms with all items mounted. In full-world view, 174-item pan/wheel p95 was 50/50 ms with 0% dropped intervals and zero long tasks. At 5,024, pan/wheel p95 was 1,316.6/1,283.3 ms, with 83.87%/60% intervals over 50 ms and 23/2 long tasks. The p95 ratios are 26.33x/25.67x. Thus the requirements of no more than 2x and no repeatable interaction task over 50 ms **failed**. See `docs/performance/2026-11-03-frame-bounded-camera-culling.md`; do not mix it with the clustered baseline or earlier distributed run. Keep content expansion NO-GO until a later renderer pass meets the performance gate and the independent human playthrough in `browser-scaling-playtest-gate.md` is complete.

## Roles and review

There is no dedicated performance, accessibility, or playtesting role. The Architect defines camera/culling boundaries; the React Developer implements frame-bounded updates; the Test Engineer owns the regression; the Code Reviewer checks behavior and measurement validity; and the Documentation Specialist records results. Agent-led review is not independent human playtesting. Keep the browser scaling/playtest plan active until its manual two-chapter journey and human feedback are complete.
