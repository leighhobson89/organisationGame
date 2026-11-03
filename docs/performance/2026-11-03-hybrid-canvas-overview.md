# Hybrid Canvas Overview Benchmark

**Decision: the same-host full-world interaction gate passes.** At 5,024 entities, pan and wheel p95 frame intervals match the 174-entity baseline, and the measured full-world interactions had no interval over 50 ms or long task over 50 ms. The independent two-chapter human playthrough remains open, so this result does not complete the content-expansion decision.

This is a new distributed-fixture measurement of the hybrid Canvas renderer. Keep it separate from the earlier clustered baseline, serialization retest, and frame-bounded camera retest; those used different renderer states or fixture geometry.

## Method and environment

`npm run test:perf` built the production app and ran the serial Edge benchmark. It used deterministic distributed synthetic filler while preserving the 174 authored items, one warm-up followed by three measured trials for each of 174, 500, 1,000, 2,500, and 5,024 entities, and fresh browser contexts for the starting, populated sparse-calibration, and full-world views. The full-world camera was `{panX: 0, panY: 0, scale: 0.2}`; the viewport was 1440 × 900 at device scale factor 1. The measured actions were pan, wheel zoom, and a real calibration-card drag. Frame sampling includes the action and a 220 ms settle window; a dropped interval is over 50 ms.

| Environment | Value |
| --- | --- |
| Captured | 2026-11-03 02:27:28 UTC |
| OS | Windows 10.0.26200, x64 |
| CPU | Intel Core i7-10700KF, 16 logical cores |
| Memory | 68,636,094,464 bytes |
| Node | v24.13.0 |
| Browser | Microsoft Edge 156.0.4314.58, headless |
| Playwright | 1.63.0 |
| Trials | One warm-up plus three measured trials |

These are raw measurements from one host and are not a device-wide guarantee.

## Full-world results

The overview Canvas represented every saved entity at all five sizes. The renderer kept 64 ordinary DOM overlays mounted for each full-world view. Median p95 frame intervals were:

| Entities | First interactive (ms) | DOM overlays | Canvas represented | Pan p95 (ms) | Wheel p95 (ms) | Drag p95 (ms) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 174 | 241.5 | 64 | 174 | 16.73 | 16.80 | 16.80 |
| 500 | 258.8 | 64 | 500 | 16.70 | 16.70 | 16.80 |
| 1,000 | 273.5 | 64 | 1,000 | 16.80 | 16.70 | 16.70 |
| 2,500 | 332.4 | 64 | 2,500 | 16.80 | 16.80 | 16.80 |
| 5,024 | 414.7 | 64 | 5,024 | 16.70 | 16.73 | 16.70 |

The gate compares matching 174- and 5,024-entity full-world medians. Values below are the three measured trials after the warm-up; all six trials retained 64 DOM overlays and represented the full entity count on Canvas.

| Entities | Trial | First interactive (ms) | Pan p95 (ms) | Wheel p95 (ms) | Drag p95 (ms) | Pan / wheel / drag intervals >50 ms | Pan / wheel / drag long tasks >50 ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 174 | 2 | 241.5 | 16.70 | 16.80 | 16.80 | 0 / 0 / 0 | 0 / 0 / 0 |
| 174 | 3 | 241.8 | 16.73 | 16.80 | 16.80 | 0 / 0 / 0 | 0 / 0 / 0 |
| 174 | 4 | 241.4 | 16.80 | 16.70 | 16.70 | 0 / 0 / 0 | 0 / 0 / 0 |
| 5,024 | 2 | 414.7 | 16.70 | 16.80 | 16.70 | 0 / 0 / 0 | 0 / 0 / 0 |
| 5,024 | 3 | 416.5 | 16.70 | 16.70 | 16.70 | 0 / 0 / 0 | 0 / 0 / 0 |
| 5,024 | 4 | 412.8 | 16.70 | 16.73 | 16.70 | 0 / 0 / 0 | 0 / 0 / 0 |

The 5,024-to-174 p95 ratios are **0.998× for pan** (16.70 / 16.73) and **0.996× for wheel** (16.73 / 16.80). Both are below the 2× limit, and no measured full-world pan or wheel interval or long task exceeded 50 ms.

## Starting and sparse views

The scale-0.5 starting view remained DOM-rendered at these counts. The populated sparse calibration view showed all eight calibration cards at each size.

| Entities | Starting ready (ms) | Starting DOM cards | Sparse ready (ms) | Sparse DOM cards |
| ---: | ---: | ---: | ---: | ---: |
| 174 | 457.4 | 150 | 166.1 | 8 |
| 500 | 448.8 | 166 | 167.9 | 8 |
| 1,000 | 490.3 | 188 | 166.6 | 8 |
| 2,500 | 509.1 | 237 | 185.7 | 8 |
| 5,024 | 534.7 | 330 | 203.2 | 8 |

These readiness and occupancy figures provide context for the full-world interaction gate. They are hardware-sensitive and should not be generalized beyond this host.

## Verification and interpretation

- `node --test --test-isolation=none tests/unit/game-foundation/render-policy.test.mjs tests/unit/game-foundation/hit-test.test.mjs`: 5/5 passed.
- Focused hybrid-renderer browser regression: 7/7 passed.
- `npm run test:e2e:performance -- --workers=1`: 12/12 passed in 44.9 seconds.
- `npm run test:perf`: production build and serial benchmark passed, 1/1 in 1.9 minutes.
- Code review found no actionable findings.
- The full test suite was not run.

The hybrid renderer keeps crisp interactive DOM cards at detail scale and paints a lightweight overview Canvas at distant or dense scales, with selected, dragged, and keyboard-focused items kept as DOM overlays. The benchmark's full-world gate therefore records Canvas representation and overlay count separately from the number of mounted DOM nodes.

The renderer performance gate now passes on this host. Keep the separate playtest/scaling plan active until the two-chapter playthrough and independent human feedback are complete. This benchmark alone does not authorize more game content; the restoration requirements, story, and ending remain future work.
