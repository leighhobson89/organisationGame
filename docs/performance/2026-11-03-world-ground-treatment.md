# World-Ground Treatment Verification

The laboratory floor now has subtle panel seams and concentric survey rings centered on the Engine hub. The marks are static CSS on the existing world-sized, `aria-hidden`, non-interactive ground layer; they follow camera pan and zoom and stay below the Canvas and interactive cards. The change adds no entities, assets, story content, save fields, or gameplay rules.

## Visual and interaction verification

- `npm run test:e2e -- --workers=1 e2e/lab/world-ground-appearance.spec.js`: 1/1 passed. It checks the ground's world bounds, hidden/non-interactive semantics, background layers and stacking, camera pan/zoom, and unchanged 174-item count.
- `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js`: 9/9 passed, including pointer drop, Canvas selection, and batch movement coverage.
- `npm run build`: passed with Vite 8.3.5.
- Playwright screenshots at Engine-centered and overview zoom were visually inspected; the floor marks remain subdued and below content.
- Code Reviewer found no actionable issues. The full test suite was not run.

## Scaling verification

`npm run test:e2e:performance -- --workers=1` passed 12/12 structural cases. `npm run test:perf` built the app and passed its serial Edge benchmark in 1.9 minutes. It used deterministic distributed synthetic filler while preserving the 174 authored items, one warm-up plus three measured trials per size, fresh contexts for each view, and a 1440 × 900 viewport at device scale factor 1. This run is separate from the other clustered and distributed fixture reports; do not treat it as a same-fixture before/after comparison. Raw machine-readable results were written to the ignored `test-results/performance-benchmark/browser-scaling-results.json`.

Environment: Windows 10 build 26200, Intel Core i7-10700KF (16 logical cores), Node v24.13.0, headless Edge 156.0.4314.58, Playwright 1.63.0. Values are same-host measurements, not guarantees for other devices.

| Entities | Start ready (ms) | Start mounted | Sparse ready (ms) | Sparse mounted | Full-world Canvas entities | Full-world DOM overlays | Full-world pan / wheel / drag p95 (ms) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 174 | 471.5 | 150 | 170.3 | 9 | 174 | 64 | 16.7 / 16.8 / 16.7 |
| 500 | 492.5 | 166 | 177.0 | 9 | 500 | 64 | 16.8 / 16.8 / 16.7 |
| 1,000 | 500.3 | 188 | 179.6 | 9 | 1,000 | 64 | 16.7 / 16.8 / 16.8 |
| 2,500 | 523.4 | 237 | 197.0 | 9 | 2,500 | 64 | 16.7 / 16.7 / 16.8 |
| 5,024 | 543.8 | 330 | 226.6 | 9 | 5,024 | 64 | 16.8 / 16.7 / 16.8 |

At 174 and 5,024 entities, the sparse view mounted all eight calibration cards plus one nearby overscan card (`field-note-032`). Its camera query correctly includes that card; the performance specs therefore require the eight calibration IDs and allow 8–10 mounted objects. This aligns the harness with the intended camera-query range and does not change runtime culling.

In full-world views, no measured pan, wheel, or drag intervals exceeded 50 ms and no long task exceeded 50 ms. At the dense 5,024-item starting view, first-interactive time was 543.8 ms, with 330 mounted DOM items. Wheel p95 was 50.1 ms versus 33.3 ms at 174 items (1.5x); 2 of 3 measured trials contained an interval over 50 ms, and the browser reported no long tasks over 50 ms. Keep this starting-view caveat alongside the full-world result. The separate human two-chapter playthrough and audio listening-quality check remain open; content expansion remains gated on independent human feedback.
