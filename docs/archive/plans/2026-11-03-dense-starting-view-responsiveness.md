# Plan: Dense Starting-View Responsiveness

**Status:** Complete. Camera-only detail-card rendering and overview Canvas invalidation are fixed, focused-verified, reviewed, documented, and archived.

## Goal and boundary

Reduce wheel-zoom frame stalls in the current dense starting view at 174 to 5,024 entities. Preserve the continuous laboratory, authored items and clues, save schema, placement/progression behavior, camera anchoring and gestures, accessibility names, detail readability, renderer thresholds, and the 64-card overview overlay limit. Do not add content or move the independently deferred playtest gate.

## Evidence and diagnosis

The current `npm run test:perf` completed successfully on the same host in 2.1 minutes. At 174 entities, the starting view mounts 150 DOM cards; the three measured wheel-zoom p95 frame intervals were 66.7, 100, and 66.7 ms, each with one interval above 50 ms. One trial also observed one long task above 50 ms. At 5,024 entities, the starting view mounts 330 DOM cards; p95 intervals were 66.6, 50, and 50.1 ms, with one interval above 50 ms in two trials and no long task above 50 ms. Full-world overview zoom remained near 16.7 ms p95.

Raw measurements are in the ignored `test-results/performance-benchmark/browser-scaling-results.json`; the run used one warm-up and three measured trials with fresh browser contexts.

The shared 174- and 5,024-entity symptom means synchronous full-world Canvas painting is not a sufficient explanation for the starting-view stalls. A focused diagnostic benchmark confirmed that a single wheel zoom from 50% to 45% stays in detail mode: 174 items retained 150 mounted cards and 5,024 items retained 335, with zero Canvas items in every measured trial. The overview threshold did not cause the measured starting-view wheel stall. On wheel settle, the 180 ms timer commits the camera, updates app camera state, and refreshes culling. `LabObject` rerendered with its parent; each card received a newly allocated `highlightSources` array and selection callbacks recreated by `App`.

The first optimization reduced the 5,024-item starting-view wheel p95 from 66.7, 66.7, and 50 ms to 50, 50.1, and 50 ms; over-50 ms frame counts went from 2, 1, and 0 to 0, 1, and 0. The renderer remained in detail mode with 335 DOM cards. At 174 items, post-optimization wheel p95 was approximately 50, 50, and 50 ms with no over-50 ms intervals. A later 5,024-item full-world overview wheel run measured p95 at 16.8, 100, and 99.9 ms, with one over-50 ms frame in trials 3 and 4; the earlier same-host run was about 16.7 ms with no such frames. These small-sample browser timings vary, so preserve the same-host comparison rather than treating individual timings as universal.

### Architect review

The first optimization memoizes `LabObject`, stabilizes its no-highlight prop, and stabilizes item-selection callbacks. Actual item, selection, highlight-source, and drag changes still update the corresponding card.

The follow-up diagnosis found a deterministic second camera-only invalidation path: `App` constructed a new empty or one-ID `highlightedItemIds` array on every camera-only render. `WorldViewport` rebuilt its highlight sets from that new identity, and the `WorldOverviewCanvas` redraw effect saw a changed set dependency and cleared/redrew the full item set. `App` now memoizes the empty and single-ID prop; `WorldViewport` uses a stable empty-array default. An actual Compass target change still produces a new set and redraws the affected highlights. The benchmark-only `CanvasRenderingContext2D.clearRect` regression verifies that camera-only overview zoom creates no extra redraw; no production render-count hook was added.

## Test plan

**Test Engineer plan:** The first optimization's effect on detail-view wheel timings is measured on the same host. For the overview path, a focused benchmark regression uses benchmark-only `CanvasRenderingContext2D.clearRect` instrumentation on `.world-overview-canvas` and asserts that a camera-only overview wheel zoom does not redraw. This counts real Canvas operations in the browser test without production render-count hooks or debug surfaces. Existing Lens/Compass behavior E2E checks protect actual highlight changes, alongside organizing, selection, drag, and filing.

Diagnostic baseline (`npm run test:perf`, passed 1/1 in 2.0 minutes): after the 50% to 45% wheel zoom, all three 174-item measured trials stayed in detail mode with 150 mounted cards and no Canvas items; wheel p95 was 49.9, 50, and 50 ms, with no interval or long task above 50 ms. At 5,024 items, all three trials stayed in detail mode with 335 mounted cards and no Canvas items; wheel p95 was 66.7, 66.7, and 50 ms, with 2, 1, and 0 intervals above 50 ms and 1, 0, and 0 long tasks above 50 ms. These are same-host before measurements, not universal thresholds.

The new Canvas redraw regression has a red baseline on current code: `npx playwright test --config=playwright.benchmark.config.js` failed after 8.0 seconds during the 174-item full-world wheel sample because the camera-only zoom produced 3 `clearRect` calls instead of the expected zero.

The existing focused browser checks to retain are `e2e/lab/organising-loop.spec.js` and `e2e/lab/resonance-lens-highlights.spec.js`; these protect user-visible selection, movement, and real Lens/Compass highlight updates. The Canvas assertion is deterministic and does not depend on a device-specific timing cutoff.

The earlier current-worktree benchmark is a separate run: at 174 items its three starting-view wheel p95s were 66.7, 100, and 66.7 ms; at 5,024 they were 66.6, 50, and 50.1 ms. It did not record post-zoom renderer mode. Keep raw runs distinct; browser frame measurements vary.

Focused functional checks should cover organizing/selection and Lens highlights, for example:

```text
npx playwright test e2e/lab/organising-loop.spec.js e2e/lab/resonance-lens-highlights.spec.js --workers=1
npm run build
npm run test:perf
```

The final same-host benchmark met the intended performance comparison without a hardware-specific threshold. Preserve the full-world clear-count regression, functional E2E coverage, and these scenarios in subsequent renderer changes.

## Implementation and verification results

- Focused renderer-policy, highlight, and first-action unit checks passed 11/11.
- Focused organizing and highlight Playwright checks passed 22/22.
- `npm run test:perf` passed 1/1 and built with Vite 8.3.5 (56 modules). At 174 entities, starting-view zoom p95 was 33.4/49.9/33.3 ms with no interval above 50 ms. At 5,024 entities it was 50/50.1/50 ms, with one above-50-ms interval in one trial and no above-50-ms long tasks. Full-world zoom at 5,024 was 16.8/16.8/16.7 ms with no interval above 50 ms.
- `npx playwright test --config=playwright.benchmark.config.js` passed 1/1 after a low-severity test guard finding was fixed. Across 15 measured full-world views (five fixture sizes by three measured trials), mode stayed overview before and after camera-only zoom, the Canvas `clearRect` delta was zero, all Canvas entities were represented, and the 64-overlay cap held. The original red baseline at 174 items produced three clears instead of zero.
- Code review found no source-level issues. `git diff --check` was clean. The full test suite was not run, as required without user approval.
- The independent human playthrough remains deferred at the user's request; the browser-scaling/playtest gate stays active and content expansion remains gated.

## Verification and review

- The focused E2E checks verified that actual organizing, selection, and highlight changes remain visible after memoization.
- Code Reviewer found no source-level issues. A low-severity benchmark test-guard finding was fixed and the benchmark was rerun successfully.
- The full suite was not run without user approval, as required by `AGENTS.md`.
- The separate browser-scaling/playtest gate remains active; the user deferred independent human feedback and content expansion remains gated.

## Completion and archiving

The finalized plan is archived as `docs/archive/plans/2026-11-03-dense-starting-view-responsiveness.md`. The separate browser-scaling/playtest gate remains active until its human-playtest criteria are satisfied.
