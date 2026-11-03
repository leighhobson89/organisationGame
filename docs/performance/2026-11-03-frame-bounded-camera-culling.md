# Frame-Bounded Camera and Culling Retest

**Decision:** **NO-GO** for content expansion. Frame-bounded camera and culling updates preserve behavior and passed focused regressions, but full-world pan/wheel performance still fails the same-host scaling gate.

This is a distinct post-optimization report. It uses the distributed synthetic-tail fixture and preserves the original clustered baseline in [`2026-11-03-browser-scaling.md`](2026-11-03-browser-scaling.md) and the earlier post-serialization distributed run in [`2026-11-03-browser-scaling-distributed-retest.md`](2026-11-03-browser-scaling-distributed-retest.md). These runs are not merged into a single before/after table.

## Run and environment

`npm run test:perf` passed 1/1, including the build and serial browser benchmark, in 4.7 minutes on the same single host and headless Edge setup described in the clustered baseline report. The benchmark covered ordinary pan/wheel input. A later external-camera prop-sync correction applies only when an external camera update arrives during an active gesture; it does not alter the measured ordinary input path.

## Full-world interaction gate

The table lists supplied endpoint summaries for the same distributed-fixture run. Individual trial rows were not provided, so this report does not reconstruct per-trial values. Mounted counts are shown as mounted/total.

| Items | Start ready | Start mounted | Sparse ready / mounted | Full-world ready / mounted | Full-world pan p95 / >50 ms / long tasks | Full-world wheel p95 / >50 ms / long tasks |
| ---: | ---: | ---: | --- | --- | --- | --- |
| 174 | 447.8 ms | 150/174 | 154.5 ms / 8 | 206.5 ms / 174 | 50 ms / 0% / 0 | 50 ms / 0% / 0 |
| 5,024 | 528.5 ms | 330/5,024 | 199.7 ms / 8 | 2,683.2 ms / 5,024 | 1,316.6 ms / 83.87% / 23 | 1,283.3 ms / 60% / 2 |
| Growth | 1.18x | - | - | - | 26.33x | 25.67x |


The target is no more than 2x the matching 174-item p95 and no repeatable interaction task over 50 ms. Both pan and wheel exceed the p95 growth target by a wide margin; at 5,024 items, many intervals exceed 50 ms and both actions have long tasks. The performance gate fails and the content-expansion NO-GO remains.

## Implementation and focused verification

The implementation applies scene transforms at frame cadence, keeps interaction camera state separate from the culling snapshot, and refreshes culling at overscan boundaries and settle. It preserves pointer conversion, zoom anchoring, pan/drag behavior, cancellation, final camera commits, and full-world/sparse counts. An internal `data-culling-revision` diagnostic supports the regression without introducing a global render counter.

- `npm run build`: passed.
- `npm run test:e2e:performance -- --workers=1`: complete opt-in regression group passed **7/7 in 32.2 seconds**, including the near-wheel/import race.
- Code review: clear; no remaining blocker.
- The full test suite was not run.

The separate external-camera prop-sync correction prevents pointerup, Escape, or a near-due wheel-settle timer from overwriting an imported camera during an active gesture. Those import cases are regression coverage; their external update is not part of the ordinary pan/wheel benchmark measurement.

## Remaining work

Keep content expansion gated. The camera/culling implementation improves update cadence and correctness but does not meet the performance target. Continue profiling React work during full-world pan/wheel, then rerun the same unprofiled benchmark on the same host and compare matching 174/5,024 cases. The independent two-chapter human playthrough also remains open; the agent-led exploratory session is not a substitute. See the active [`browser-scaling-playtest-gate.md`](../plans/browser-scaling-playtest-gate.md) for that remaining work.
