# Browser Scaling Retest: Distributed Fixture After Serialization Optimization

**Decision:** Serialization optimization met its performance goal. Content expansion remains **NO-GO** because full-world rendering and pan/wheel interactions still exceed the renderer gate.

This is a separate post-serialization retest using deterministic distributed synthetic filler. The original clustered-fixture benchmark remains unchanged at [`2026-11-03-browser-scaling.md`](2026-11-03-browser-scaling.md); its occupancy and timings are not a same-fixture before/after comparison with this report.

## Result summary

The production build and opt-in serial browser benchmark passed 1/1 with `npm run test:perf` in 4.5 minutes. The measurements below are the reported benchmark summaries for 174 and 5,024 entities. The authored 174-item game content is retained; larger saves append distributed synthetic tail records.

| Items | Start ready | Start mounted | Calibration sparse ready | Sparse mounted | Full-world ready | Full-world mounted |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 174 | 448.3 ms | 150/174 (86.2%) | 155.2 ms | 8 | 204.7 ms | 174/174 |
| 5,024 | 534.7 ms | 330/5,024 (6.6%) | 202.2 ms | 8 | 2,633.1 ms | 5,024/5,024 |

Starting-view readiness grew 1.19× from 174 to 5,024; the distributed filler lowered visible occupancy to 6.6% at the larger save. The populated sparse view continued to mount the eight calibration cards. Full-world readiness grew substantially because it mounts every item.

At 5,024 items, full-world pan and wheel-zoom p95 RAF intervals were 1,266.7 ms and 850 ms. The share of intervals over 50 ms was 90% and 67%, respectively; the actions observed 23 and 1 long tasks. These timings are from one headless Edge host and do not establish performance on other hardware.

## Serialization profile result

The reviewed profile harness completed 1/1 with `npm run profile:perf`, producing ten captures. After the serialization change, profiles showed no LZ-String `_compress` work during pan, wheel zoom, drag, or delayed autosave; startup showed `_decompress` only. Writing roughly 340 KB to localStorage took about 0.4 ms. This supports the serialization goal: duplicate export compression was removed from ordinary updates, and autosave compression no longer occupied the main thread in the profiled flows. It does not establish that React rendering or world culling is inexpensive.

Profiler traces are diagnostic and instrumented; do not compare their durations with the unprofiled benchmark. The startup capture is labeled `startup-including-initial-autosave`; the initial 450 ms debounce may fall inside the readiness window. Trace positions use raw `traceClockMs`, not capture-relative `startMs`. Raw profile artifacts remain ignored under `test-results/performance-profiles/`.

## Verification

- `node --test --test-isolation=none tests/unit/game-foundation/autosave-coordinator.test.mjs`: 11/11 passed.
- `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js`: 21/21 passed.
- `npm run test:e2e:performance -- --workers=1`: 3/3 structural cases passed.
- `npm run profile:perf`: 1/1, ten captures.
- `npm run test:perf`: production build and benchmark passed 1/1 in 4.5 minutes.

The full test suite was not part of this focused milestone verification.

## Remaining renderer gate

The next renderer attempt used frame-bounded camera/culling updates; its separate same-host retest still failed the pan/wheel gate, as reported in [`2026-11-03-frame-bounded-camera-culling.md`](2026-11-03-frame-bounded-camera-culling.md). A complete two-chapter manual playthrough and independent human feedback also remain open; see [`../playtests/2026-11-03-research-chapters.md`](../playtests/2026-11-03-research-chapters.md).
