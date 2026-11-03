# Dense Starting-View Render Threshold

The renderer now enters Canvas overview above 256 visible items and returns
to detail at 192 or fewer when zoom is at least 0.5. The 174-item starting
view remains in detail. The 5,024-item starting view paints all 5,024 entities
on Canvas and keeps 64 DOM overlays.

## Method

`npm run test:perf` built the app and ran the serial Edge benchmark. It used
deterministically distributed synthetic filler across the world bounds while
preserving the 174 authored items, IDs, and positions. The five save sizes
were 174, 500, 1,000, 2,500, and 5,024 entities. The starting camera was at
0.5 scale in a 1440 × 900 browser viewport; the measured WorldViewport client
area was 1440 × 808, with device scale factor 1. Each view used a fresh browser
context, with one warm-up and three measured trials.

Pan, wheel zoom, and calibration-card drag each include the action and its
220ms settle window. The table reports the per-trial p95 animation-frame
interval in milliseconds. Each measured start-view pan, wheel, and drag had
zero sampled intervals over 50ms and zero long tasks over 50ms.

**Environment:** Windows 10 build 26200, Intel Core i7-10700KF (16 logical
cores), Node v24.13.0, headless Edge 156.0.4314.58, Playwright 1.63.0. The
benchmark took 1.9 minutes and passed 1/1 after the build.

## Starting-view trial results

| Entities | Trial | Renderer | DOM cards / overlays | Canvas entities | Pan p95 | Wheel p95 | Drag p95 | >50ms intervals / long tasks |
| ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 174 | 2 | Detail | 150 | 0 | 33.4 | 50.0 | 16.8 | 0 / 0 |
| 174 | 3 | Detail | 150 | 0 | 33.4 | 33.4 | 16.7 | 0 / 0 |
| 174 | 4 | Detail | 150 | 0 | 33.3 | 50.0 | 16.8 | 0 / 0 |
| 500 | 2 | Detail | 166 | 0 | 33.4 | 33.4 | 16.8 | 0 / 0 |
| 500 | 3 | Detail | 166 | 0 | 33.3 | 50.0 | 16.7 | 0 / 0 |
| 500 | 4 | Detail | 166 | 0 | 33.4 | 33.4 | 16.7 | 0 / 0 |
| 1,000 | 2 | Detail | 188 | 0 | 33.4 | 50.0 | 16.8 | 0 / 0 |
| 1,000 | 3 | Detail | 188 | 0 | 33.5 | 50.0 | 16.8 | 0 / 0 |
| 1,000 | 4 | Detail | 188 | 0 | 33.3 | 50.0 | 16.7 | 0 / 0 |
| 2,500 | 2 | Detail | 237 | 0 | 33.4 | 33.3 | 16.7 | 0 / 0 |
| 2,500 | 3 | Detail | 237 | 0 | 33.4 | 50.0 | 16.7 | 0 / 0 |
| 2,500 | 4 | Detail | 237 | 0 | 33.5 | 50.0 | 16.8 | 0 / 0 |
| 5,024 | 2 | Overview | 64 | 5,024 | 16.7 | 16.8 | 16.7 | 0 / 0 |
| 5,024 | 3 | Overview | 64 | 5,024 | 16.7 | 16.7 | 16.7 | 0 / 0 |
| 5,024 | 4 | Overview | 64 | 5,024 | 16.7 | 16.8 | 16.8 | 0 / 0 |

Trial numbering starts at 2 because trial 1 is the warm-up. The threshold
leaves the 174, 500, 1,000, and 2,500 starting views in detail; the 5,024
starting view switches to Canvas. Its wheel p95 median is 16.8ms, compared to
50.0ms in the previous same-host distributed-fixture run, a 66.4% lower median.
That earlier run's detailed renderer work and measurements are recorded in the
[dense starting-view responsiveness plan](../archive/plans/2026-11-03-dense-starting-view-responsiveness.md).

The comparison is between separate runs on the same host and distributed
fixture setup; it is specific evidence for this render-policy change, not a
cross-device guarantee. Three measured trials are a small sample. The 174-item
view's wheel p95 remains variable at 33.4/50.0/50.0ms, but it stays in detail
mode and all its measured pan, wheel, and drag intervals remain at or below
50ms.

## Verification

- `node --test --test-isolation=none tests/unit/game-foundation/render-policy.test.mjs`: 3/3 passed.
- `npm run test:e2e:performance -- --workers=1`: 12/12 passed, preserving the 174/5,024 Canvas selection, drag, pan, zoom, save/reload, and representation checks.
- `npm run build`: passed with Vite 8.3.5.
- `npm run test:perf`: build and serial benchmark passed 1/1 in 1.9 minutes.
- Code Reviewer found no actionable findings; `git diff --check` was clean.
- The full suite was not run. The independent human playtest remains deferred, so content expansion stays gated.
