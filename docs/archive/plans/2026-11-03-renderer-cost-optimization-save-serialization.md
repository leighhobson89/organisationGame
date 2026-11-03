# Plan: Renderer-Cost Optimization (Save Serialization First)

**Status:** Completed, accepted, and reviewed; archived 2026-11-03. Serialization implementation, focused verification, post-change profiling, and the distributed-fixture retest are complete. The clustered baseline and distributed retest remain in separate reports. The separate `browser-scaling-playtest-gate.md` remains active for the renderer gate and incomplete two-chapter human playthrough.

## Goal

The milestone removed duplicate main-thread compression from ordinary state updates and moved debounced autosave JSON/LZ serialization to a worker. The existing save format, authored entities and placements, and autosave/recovery behavior were preserved. Serialization met its performance goal; content scaling remains NO-GO until full-world renderer costs are addressed and retested.

## Diagnostic order

1. Preserve the completed clustered-fixture benchmark in `docs/performance/2026-11-03-browser-scaling.md` as the pre-optimization reference. Its 5,024 generated-item placement is clustered and is not the same spatial fixture as the new distributed filler.
2. Use one shared deterministic fixture helper from `performance/` in the structural regression, profiling harness, and five-size benchmark. It preserves the original authored 174 records and placements, appends only deterministic synthetic tail items distributed through remote lower/right regions, and keeps IDs/positions reproducible.
3. The isolated profiler completed ten captures at 174 and 5,024 items, using the same production build, distributed fixture, 1440 by 900 viewport, cameras, headless Edge host, and context/cache policy. Its phase order was startup from before navigation through the view-ready barrier, Space plus mouse-drag pan, wheel plus settle, drag/drop, then delayed autosave separately.
4. Inspect JS CPU samples and browser traces for JavaScript, style recalculation, layout, paint, and compositing. Profiles are under ignored `test-results/performance-profiles/`; keep them diagnostic and never compare profiler-instrumented durations to the unprofiled benchmark.

The **pre-optimization** profile pointed to LZ-String `_compress` as the largest repeated main-thread cost at 5,024 items: sampled self-time was about 210 ms at startup, 225 ms during pan, 256 ms during wheel, 191 ms during drag, and 223 ms during delayed autosave. A `localStorage.setItem` of about 340 KB took about 0.8 ms. Source-map inspection found eager Save & Restore export computation on every game update and a second autosave compression after the 450 ms debounce. The post-optimization profile found no `_compress` in pan, wheel, drag, or autosave; startup showed `_decompress` only, and a roughly 340 KB storage write took about 0.4 ms. React/DOM and full-world pan/wheel costs remain significant and are deferred to a separate renderer milestone.

## Implementation scope after profile review

- [x] Compute the Save & Restore export only when its dialog opens and encode the latest state, without compression on ordinary closed-dialog game updates.
- [x] Move autosave JSON serialization and LZ compression to a worker. Retain the 450 ms debounce and keep `localStorage.setItem` on the main thread.
- [x] Tag worker requests and replies with monotonically increasing revision/request IDs. Ignore replies made stale by a newer state update or import.
- [x] On worker creation, `postMessage`, or execution failure, preserve the previous valid autosave and report autosave unavailable. Unsupported Worker follows the same unavailable-and-preserve behavior; there is no synchronous fallback.
- Leave manual export and backup worker conversion out unless later profiles show it is needed. Keep the existing save schema and compressed format unchanged.
- [x] Use the shared deterministic synthetic fixture helper across regression, profiling, and five-size benchmark harnesses. Preserve authored entities and exact placements; retain the clustered baseline separately from distributed-fixture results.
- Defer broad React/DOM renderer memoization and spatial-index changes to a separate follow-up. The clustered baseline measured 1.4–1.9 s starting-view pan/wheel p95 and near-total default-camera mounts at 5,024; the distributed retest reduced start occupancy but still measured 1,266.7/850 ms full-world pan/wheel p95. The latest results keep content expansion gated.

## Preserved behavior

- The 174 authored entities retain their current canonical IDs, definitions, and placements in saved state.
- Larger generated fixtures stay deterministic and retain unique IDs and exact entity counts.
- Pointer pan, wheel zoom, real pointer drag/drop, autosave, inspector/keyboard movement, and save/reload behavior remain correct.
- The populated sparse camera mounts exactly its eight calibration cards; the full-world camera mounts every entity.
- The existing v3 save/import behavior, backup and recovery protections, and chapter progression remain unchanged.
- The Save & Restore dialog exports the latest state on opening. Debounced autosave stores the latest accepted state and reload restores it.
- Stale worker responses cannot replace a newer autosave after state changes or import. Worker failure leaves the last valid autosave intact and announces unavailable autosave.

## Focused test plan

The Test Engineer wrote these focused regressions in parallel with this plan. Final milestone results:

- `tests/unit/game-foundation/autosave-coordinator.test.mjs`, run with `node --test --test-isolation=none tests/unit/game-foundation/autosave-coordinator.test.mjs`: **11/11 passed**. Through the injected worker, storage, and fake-timer seam in `src/game/persistence/autosaveCoordinator.js`, this verifies the 450 ms debounce, latest revision, ignoring stale replies after newer state or import, and worker/postMessage failure preserving the previous autosave and reporting unavailable. The explicit case `an unavailable Worker preserves the previous save, reports unavailable, and disposes safely` passes with `worker: null`, ensuring unsupported Worker does not trigger a main-thread fallback write.
- `e2e/lab/world-and-save-recovery.spec.js`: **21/21 passed** with `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js`. This includes the case `Save & Restore exports the latest state when opened during the autosave debounce`, plus import, backup, and recovery behavior.

The existing structural regression remains required:

- `performance/browser-scaling-regression.spec.js`, command `npm run test:e2e:performance -- --workers=1`.
- The shared fixture helper distributes synthetic tail items deterministically through the remote lower/right world, asserts repeated IDs and positions match, preserves the original first 174 records exactly as `generateLab(seed, 174)`, produces 5,024 unique IDs, and covers at least 12 coarse world regions.
- The 174- and 5,024-item browser cases retain exact total count and ordered/unique IDs, show a calibration item in a sparse view with at most 10 mounted elements, verify pan and wheel zoom, drag calibration-card-01 into the cabinet, wait for autosave, and assert all non-dragged authored positions are unchanged and the dragged item is filed correctly. Reloading at scale 0.2 must mount every saved item.
- Final focused structural result after the serialization change: **3/3 passed** with `npm run test:e2e:performance -- --workers=1`. The focused sparse regression allows up to 10 mounted objects; the full benchmark separately asserts the exact eight-card calibration ID set.

Do not add a React function-render counter to this serialization change. DOM identity and `MutationObserver` alone cannot prove component function rerenders, and there is no existing test-only render-accounting hook. Broad React/DOM rendering is a separate follow-up and should use the already captured browser profiles to choose its own diagnostics.

Serialization-scope success criteria, all met:

- [x] Save & Restore computes the export only when opened and exports the latest accepted state.
- [x] Closed-dialog updates do not run LZ compression on the main thread. Autosave sends the latest revision to the worker after the 450 ms debounce, then writes only the current successful result to localStorage on the main thread.
- [x] Stale worker responses after a newer update or import are ignored. Worker failure or unsupported Worker leaves the prior valid save untouched and reports autosave unavailable; synchronous fallback is not used.
- [x] Latest autosave survives reload with exact ordered IDs and placements; existing v3 import, manual backup, recovery, and authored positions remain intact.
- [x] The post-change profile and unprofiled benchmark are recorded separately. The profile shows `_compress` has left pan, wheel, drag, and autosave captures; profiler-instrumented timings are never compared as benchmark results.

The renderer gates remain in the active `browser-scaling-playtest-gate.md`; they are not acceptance criteria for this serialization-only increment. The distributed fixture achieved low start-view occupancy (330/5,024, 6.6%), but the full-world interaction gate remains unmet. The next renderer increment must:

- Reduce React work during full-world pan and wheel while preserving camera transform, hit-testing, drag/drop, zoom, save/reload, and accessibility semantics.
- On the same host and matching full-world view, keep pan and wheel p95 at most 2× the matching 174-item baseline.
- There is no repeatable interaction long task over 50 ms.
- Keep the populated sparse view at exactly eight authored calibration cards and full-world view at all N entities.
- Preserve exact total count, ordered/unique IDs, authored placements, and filed placement after the real drag/autosave cycle.

Final focused evidence: coordinator unit checks 11/11; recovery E2E 21/21; structural regression 3/3; `npm run profile:perf` 1/1 with ten captures; and `npm run test:perf` build/benchmark 1/1 in 4.5 minutes. The separate distributed retest report records start readiness 448.3→534.7 ms (174→5,024), sparse readiness 155.2→202.2 ms with eight mounted, and full-world readiness 204.7→2,633.1 ms with all items mounted. At 5,024, full-world pan/wheel p95 was 1,266.7/850 ms, with 90%/67% intervals over 50 ms and 23/1 long tasks. The clustered baseline remains in its own report; never combine it with distributed-fixture values or profiler-instrumented timings.

## Review and exclusions

The Architect accepted the serialization performance goal and the Code Reviewer completed sign-off. Content expansion remains gated until the separate renderer follow-up and the active scaling/playtest plan are complete. This milestone does not complete the two-chapter human playthrough, independent playtesting, additional story, ending, or broad cross-device performance validation.
