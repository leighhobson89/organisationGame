# Browser Scaling Benchmark

**Decision:** **NO-GO** for expanding content with the current DOM renderer. Optimize and repeat the browser benchmark before raising the supported content count. This result describes one host and one headless Edge configuration; it is not a device-wide guarantee.

**Fixture label:** This is the completed pre-optimization baseline using the original clustered `generateLab` placement for synthetic records. The post-serialization retest uses a distinct distributed-tail fixture and is recorded separately in [`2026-11-03-browser-scaling-distributed-retest.md`](2026-11-03-browser-scaling-distributed-retest.md). Keep the reports separate; they are not a same-fixture before/after comparison.

## Run and environment

The clean benchmark ran on 2026-11-03. `npm run test:perf` completed its production build and the isolated Playwright benchmark passed 1/1 in about 8.3 minutes. It covered five v3 save sizes (174, 500, 1,000, 2,500, and 5,024 items), with one warm-up and three measured serial trials per size. Warm-ups are excluded from the values below. The opt-in structural regression separately passed 2/2 at 174 and 5,024 items with `npm run test:e2e:performance -- --workers=1`.

| Host/runtime | Value |
| --- | --- |
| OS / architecture | Windows 10.0.26200, x64 |
| CPU / logical cores | Intel Core i7-10700KF at 3.80 GHz / 16 |
| Installed memory | 68,636,094,464 bytes (about 64 GiB) |
| Node | v24.13.0 |
| Browser | Microsoft Edge 156.0.4314.58, headless (`msedge` channel) |
| Playwright | 1.63.0 |
| Configured viewport / device scale | 1440 by 900 / 1 |
| Spatial grid cell size | 320 world units |

The benchmark uses deterministic generated items while preserving authored content, validates the v3 fixtures, and serves the built app through Vite preview. Synthetic records use the original clustered generator placement in this baseline. Each size and view uses a fresh browser context, the same app build, viewport, and cache policy. The three views are the starting camera `(110, 91, 0.5)`, the populated calibration-only sparse camera `(-1840, -964, 2.5)`, and the full-world stress camera `(0, 0, 0.2)`. Interactions measured in each view are mouse pan, wheel zoom, and a real drag of `calibration-card-01` into `cabinet-calibration`.

The JSON field `firstInteractiveTimeMs` is a historical name: the recorded value is the **view-ready time after that view's DOM readiness barrier**, not the first counter or first object paint. The starting view waits for a stable mounted count; the sparse view waits until its eight calibration cards are mounted; the full-world view waits until all N items are mounted. RAF p50/p95/p99 and the share of intervals over 50 ms include the interaction action plus the 220 ms settle window. Long-task observation uses the same action-plus-settle window. A dropped interval means strictly greater than 50 ms. Long-task columns below report the count of tasks over 50 ms and each trial's longest observed task duration.

The preliminary 8m24s run using an empty sparse camera and shared context, and the later partial run that failed 5,024-item sparse viewport readiness, are invalidated and excluded. The clean run used fresh contexts, the populated sparse view, and a readiness barrier that waits for the viewport dimensions to settle.

## Readiness and mounted occupancy

Each ready-time cell lists measured trial 1 / 2 / 3, followed by the median. Mounted counts, area fractions, and mounted-to-uniform ratios were stable across the three trials for each size and view. The area fraction is the portion of the 5,200 by 3,400 world visible to the viewport; mounted/uniform compares actual mounted DOM nodes with the count expected from a uniform spread over that area.

| Items | View | Ready time ms: T1 / T2 / T3; median | Mounted DOM: count / N | Visible world area | Mounted / uniform estimate |
| ---: | --- | --- | ---: | ---: | ---: |
| 174 | Start | 465.3 / 465.6 / 462.4; **465.3** | 150 / 174 (86.21%) | 27.46% | 3.14x |
| 174 | Calibration sparse | 167.1 / 176.7 / 174.1; **174.1** | 8 / 174 (4.60%) | 1.59% | 2.89x |
| 174 | Full world | 218.9 / 216.0 / 213.9; **216.0** | 174 / 174 (100%) | 100% | 1.00x |
| 500 | Start | 553.9 / 570.6 / 559.5; **559.5** | 476 / 500 (95.20%) | 27.46% | 3.47x |
| 500 | Calibration sparse | 185.5 / 199.1 / 189.1; **189.1** | 8 / 500 (1.60%) | 1.59% | 1.00x |
| 500 | Full world | 449.5 / 449.7 / 453.1; **449.7** | 500 / 500 (100%) | 100% | 1.00x |
| 1,000 | Start | 904.3 / 821.0 / 825.6; **825.6** | 976 / 1,000 (97.60%) | 27.46% | 3.55x |
| 1,000 | Calibration sparse | 205.3 / 204.9 / 205.5; **205.3** | 8 / 1,000 (0.80%) | 1.59% | 0.50x |
| 1,000 | Full world | 693.1 / 706.4 / 693.4; **693.4** | 1,000 / 1,000 (100%) | 100% | 1.00x |
| 2,500 | Start | 1,825.7 / 1,834.9 / 1,824.6; **1,825.7** | 2,476 / 2,500 (99.04%) | 27.46% | 3.61x |
| 2,500 | Calibration sparse | 323.9 / 304.1 / 298.3; **304.1** | 8 / 2,500 (0.32%) | 1.59% | 0.20x |
| 2,500 | Full world | 1,411.2 / 1,425.3 / 1,425.6; **1,425.3** | 2,500 / 2,500 (100%) | 100% | 1.00x |
| 5,024 | Start | 4,075.6 / 4,020.5 / 4,029.3; **4,029.3** | 5,000 / 5,024 (99.52%) | 27.46% | 3.62x |
| 5,024 | Calibration sparse | 394.9 / 399.7 / 401.0; **399.7** | 8 / 5,024 (0.16%) | 1.59% | 0.10x |
| 5,024 | Full world | 2,623.6 / 2,625.9 / 2,597.5; **2,623.6** | 5,024 / 5,024 (100%) | 100% | 1.00x |

Median ready-time ratio relative to the 174-item case:

| Items | Start | Calibration sparse | Full world |
| ---: | ---: | ---: | ---: |
| 174 | 1.00x | 1.00x | 1.00x |
| 500 | 1.20x | 1.09x | 2.08x |
| 1,000 | 1.77x | 1.18x | 3.21x |
| 2,500 | 3.92x | 1.75x | 6.60x |
| 5,024 | 8.66x | 2.30x | 12.15x |

At the starting camera, 5,024 items took 8.66 times as long to reach the stable view-ready condition as 174 items (4,029.3 ms vs. 465.3 ms). The default starting camera mounted 5,000 of 5,024 items. At this view's 27.46% visible-area fraction, a uniform spread would predict about 1,380 mounted items; actual occupancy was 3.62 times that estimate. The sparse camera did cull reliably to the eight authored calibration cards, but sparse-view readiness also rose from 174.1 ms to 399.7 ms as the save grew.

View-ready long-task totals were collected from navigation through each view's readiness barrier, before the interactions. Cells give trial 1 / 2 / 3. These are observer event counts and summed durations; per-interaction maximum individual task durations are in the tables below.

| Items | View | Events: T1/T2/T3 | Events over 50 ms: T1/T2/T3 | Total duration ms: T1/T2/T3 |
| ---: | --- | --- | --- | --- |
| 174 | Start | 1/1/0 | 1/1/0 | 55/55/0 |
| 174 | Calibration sparse | 0/0/0 | 0/0/0 | 0/0/0 |
| 174 | Full world | 1/1/0 | 1/1/0 | 70/69/0 |
| 500 | Start | 1/1/1 | 1/1/0 | 51/51/50 |
| 500 | Calibration sparse | 0/0/0 | 0/0/0 | 0/0/0 |
| 500 | Full world | 2/2/2 | 2/2/2 | 121/122/122 |
| 1,000 | Start | 1/1/1 | 1/1/1 | 79/80/80 |
| 1,000 | Calibration sparse | 1/1/1 | 1/1/1 | 66/66/65 |
| 1,000 | Full world | 1/1/1 | 1/1/1 | 86/86/86 |
| 2,500 | Start | 2/2/2 | 2/2/2 | 283/275/280 |
| 2,500 | Calibration sparse | 1/1/1 | 1/1/1 | 134/142/135 |
| 2,500 | Full world | 2/2/2 | 2/2/2 | 291/290/293 |
| 5,024 | Start | 2/2/2 | 2/2/2 | 533/533/528 |
| 5,024 | Calibration sparse | 1/1/1 | 1/1/1 | 244/248/246 |
| 5,024 | Full world | 3/3/3 | 3/3/3 | 619/615/622 |

## Spatial-grid density

These counts describe how many distinct entities overlap each occupied 320-unit index cell, before view culling.

| Items | Occupied cells | Entities/cell p50 | p95 | Maximum |
| ---: | ---: | ---: | ---: | ---: |
| 174 | 32 | 5 | 21 | 31 |
| 500 | 34 | 13 | 69 | 96 |
| 1,000 | 34 | 26 | 138 | 199 |
| 2,500 | 36 | 53 | 345 | 528 |
| 5,024 | 36 | 105 | 721 | 1,068 |

## Interaction measurements

Each row reports the three measured trials, followed by the median of those trials. RAF entries are `p50 / p95 / p99` milliseconds. Drop entries are percentages of sampled RAF intervals strictly above 50 ms. Long-task entries show counts over 50 ms (`T1/T2/T3`) and maximum individual duration in milliseconds (`T1/T2/T3`). `calibrationDrag` is the real drag action described above. Times can vary by host and this is a one-host result.

### Starting camera

| Items | Action | RAF p50/p95/p99 ms: T1; T2; T3; median | >50 ms intervals: T1/T2/T3; median | Long tasks >50 ms: counts; max duration ms |
| ---: | --- | --- | --- | --- |
| 174 | pan | 16.7/33.4/49.9; 16.7/33.4/33.4; 16.7/33.4/33.4; **16.7/33.4/33.4** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 174 | wheelZoom | 16.7/50/50; 16.7/50/50; 16.7/33.4/33.4; **16.7/50/50** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 174 | calibrationDrag | 16.7/16.7/16.8; 16.7/16.7/16.8; 16.7/16.8/16.8; **16.7/16.7/16.8** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 500 | pan | 83.4/133.3/199.9; 99.9/200.1/200.1; 83.2/133.2/150; **83.4/133.3/199.9** | 70/77.78/53.57%; **70%** | 0/0/0; 0/0/0 |
| 500 | wheelZoom | 16.7/116.6/116.6; 16.7/116.6/116.6; 16.7/133.3/133.3; **16.7/116.6/116.6** | 42.86/42.86/28.57%; **42.86%** | 1/1/0; 78/63/0 |
| 500 | calibrationDrag | 16.7/33.3/66.7; 16.7/16.8/50; 16.7/16.7/16.7; **16.7/16.8/50** | 3.45/0/0%; **0%** | 0/0/0; 0/0/0 |
| 1,000 | pan | 16.8/250.1/366.6; 183.2/250.1/366.7; 183.3/233.4/366.6; **183.2/250.1/366.6** | 48.28/52/60.87%; **52%** | 0/0/0; 0/0/0 |
| 1,000 | wheelZoom | 16.7/216.7/216.7; 150/233.4/233.4; 16.7/216.7/216.7; **16.7/216.7/216.7** | 33.33/66.67/50%; **50%** | 0/0/0; 0/0/0 |
| 1,000 | calibrationDrag | 16.7/33.3/33.3; 16.7/33.3/33.4; 16.7/33.4/66.7; **16.7/33.3/33.4** | 0/0/3.23%; **0%** | 0/1/0; 0/59/50 |
| 2,500 | pan | 583.3/966.6/966.6; 566.6/866.6/950.1; 566.7/766.7/966.6; **566.7/866.6/966.6** | 72.22/59.09/56.52%; **59.09%** | 4/4/4; 210/206/173 |
| 2,500 | wheelZoom | 33.4/783.3/783.3; 33.3/766.5/766.5; 33.4/766.6/766.6; **33.4/766.6/766.6** | 50/50/42.86%; **50%** | 3/3/3; 123/119/100 |
| 2,500 | calibrationDrag | 16.7/100/183.3; 16.7/100/183.5; 16.7/100.1/150; **16.7/100/183.3** | 8.82/11.11/12.12%; **11.11%** | 2/2/2; 113/118/115 |
| 5,024 | pan | 483.3/1383.4/1933.3; 433.3/1450.1/1950; 516.7/1349.9/1950; **483.3/1383.4/1950** | 81.25/75/83.33%; **81.25%** | 22/22/20; 2,318/2,204/2,333 |
| 5,024 | wheelZoom | 66.6/1899.9/1899.9; 66.7/1916.6/1916.6; 16.8/1466.6/1466.6; **66.6/1899.9/1899.9** | 60/60/42.86%; **60%** | 5/5/4; 1,208/1,200/1,192 |
| 5,024 | calibrationDrag | 16.7/250.1/300; 16.7/233.4/283.3; 16.7/200/449.9; **16.7/233.4/300** | 12.12/12.5/23.08%; **12.5%** | 4/2/5; 261/231/268 |

### Populated calibration-only sparse camera

| Items | Action | RAF p50/p95/p99 ms: T1; T2; T3; median | >50 ms intervals: T1/T2/T3; median | Long tasks >50 ms: counts; max duration ms |
| ---: | --- | --- | --- | --- |
| 174 | pan | 16.7/16.8/16.8; 16.7/16.7/16.7; 16.7/16.8/16.8; **16.7/16.8/16.8** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 174 | wheelZoom | 16.7/16.7/16.7; 16.7/16.8/16.8; 16.7/16.8/16.8; **16.7/16.8/16.8** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 174 | calibrationDrag | 16.7/16.7/16.7; 16.7/16.8/16.8; 16.7/16.8/16.8; **16.7/16.8/16.8** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 500 | pan | 16.7/16.8/16.8; 16.7/16.8/16.8; 16.7/16.7/16.7; **16.7/16.8/16.8** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 500 | wheelZoom | 16.7/16.7/16.7; 16.7/16.7/16.7; 16.7/16.7/16.7; **16.7/16.7/16.7** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 500 | calibrationDrag | 16.7/16.7/16.8; 16.7/16.8/16.8; 16.7/16.8/16.8; **16.7/16.8/16.8** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 1,000 | pan | 16.7/16.7/16.7; 16.7/16.8/33.4; 16.7/16.8/16.8; **16.7/16.8/16.8** | 0/0/0%; **0%** | 0/1/0; 0/51/0 |
| 1,000 | wheelZoom | 16.7/16.7/16.7; 16.7/16.7/16.7; 16.7/16.7/16.7; **16.7/16.7/16.7** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 1,000 | calibrationDrag | 16.7/33.3/33.4; 16.7/16.8/33.3; 16.7/33.4/33.4; **16.7/33.3/33.4** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 2,500 | pan | 16.7/16.7/66.7; 16.7/16.8/66.6; 16.7/50/66.6; **16.7/16.8/66.6** | 3.23/3.33/3.33%; **3.33%** | 1/1/1; 87/88/90 |
| 2,500 | wheelZoom | 16.7/66.6/66.6; 16.7/66.6/66.6; 16.7/83.3/83.3; **16.7/66.6/66.6** | 7.69/8.33/7.69%; **7.69%** | 1/1/1; 83/83/93 |
| 2,500 | calibrationDrag | 16.7/100/150; 16.7/99.9/116.7; 16.7/100/150; **16.7/100/150** | 12.5/12.12/12.12%; **12.12%** | 2/2/2; 117/115/120 |
| 5,024 | pan | 16.7/16.8/183.3; 16.7/16.7/183.3; 16.7/16.7/183.3; **16.7/16.7/183.3** | 3.45/3.33/3.33%; **3.33%** | 1/1/1; 199/204/200 |
| 5,024 | wheelZoom | 16.7/149.9/149.9; 16.7/149.9/149.9; 16.7/166.6/166.6; **16.7/149.9/149.9** | 7.14/8.33/7.69%; **7.69%** | 1/1/1; 178/170/176 |
| 5,024 | calibrationDrag | 16.7/233.3/300; 16.7/216.6/299.9; 16.7/200/233.3; **16.7/216.6/299.9** | 18.75/18.75/15.15%; **18.75%** | 3/3/4; 243/229/243 |

### Full-world stress camera

| Items | Action | RAF p50/p95/p99 ms: T1; T2; T3; median | >50 ms intervals: T1/T2/T3; median | Long tasks >50 ms: counts; max duration ms |
| ---: | --- | --- | --- | --- |
| 174 | pan | 33.3/50/50; 33.2/50/50; 33.3/50/50; **33.3/50/50** | 4.17/0/0%; **0%** | 0/0/0; 0/0/0 |
| 174 | wheelZoom | 16.7/50/50; 16.7/50/50; 16.7/33.3/33.3; **16.7/50/50** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 174 | calibrationDrag | 16.7/16.7/16.8; 16.7/16.7/16.7; 16.7/16.7/16.8; **16.7/16.7/16.8** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 500 | pan | 66.7/116.7/183.2; 83.3/149.9/200; 100/183.4/200; **83.3/149.9/200** | 52/52/59.09%; **52%** | 0/0/0; 0/0/0 |
| 500 | wheelZoom | 16.7/116.7/116.7; 16.7/133.4/133.4; 16.64/133.4/133.4; **16.7/133.4/133.4** | 33.33/16.67/16.67%; **16.67%** | 1/0/1; 55/50/64 |
| 500 | calibrationDrag | 16.7/16.8/16.8; 16.7/16.8/16.8; 16.7/16.7/16.7; **16.7/16.8/16.8** | 0/0/0%; **0%** | 0/0/0; 0/0/0 |
| 1,000 | pan | 216.6/333.4/333.4; 216.7/383.4/383.4; 216.7/333.4/333.4; **216.7/333.4/333.4** | 77.78/73.68/68.42%; **73.68%** | 0/0/0; 0/0/0 |
| 1,000 | wheelZoom | 16.7/299.9/299.9; 16.7/316.68/316.68; 16.7/300.08/300.08; **16.7/300.08/300.08** | 50/50/50%; **50%** | 1/1/1; 88/88/88 |
| 1,000 | calibrationDrag | 16.7/33.3/50; 16.7/33.4/50; 16.7/33.4/50.1; **16.7/33.4/50** | 0/0/3.13%; **0%** | 0/0/0; 0/0/0 |
| 2,500 | pan | 66.6/833.4/1,033.3; 566.6/833.3/1,033.3; 83.4/700/816.6; **83.4/833.3/1,033.3** | 53.57/56.52/56%; **56%** | 5/4/6; 185/175/195 |
| 2,500 | wheelZoom | 16.7/1,066.6/1,066.6; 16.7/1,116.6/1,116.6; 16.7/983.4/983.4; **16.7/1,066.6/1,066.6** | 37.5/37.5/37.5%; **37.5%** | 3/3/3; 109/106/109 |
| 2,500 | calibrationDrag | 16.7/100/183.3; 16.7/100.1/166.6; 16.7/99.9/183.4; **16.7/100/183.3** | 14.29/13.79/16.67%; **14.29%** | 2/2/2; 118/127/115 |
| 5,024 | pan | 783.3/1,500/1,683.3; 333.3/1,366.6/1,649.9; 366.7/1,383.3/1,749.9; **366.7/1,383.3/1,683.3** | 88/64.1/70.27%; **70.27%** | 23/24/23; 1,925/1,911/1,905 |
| 5,024 | wheelZoom | 599.9/1,549.9/1,549.9; 583.39/1,549.9/1,549.9; 600.1/1,549.9/1,549.9; **599.9/1,549.9/1,549.9** | 100/100/100%; **100%** | 1/1/1; 577/578/575 |
| 5,024 | calibrationDrag | 16.7/200/449.9; 16.7/216.7/450; 16.7/200/450; **16.7/200/450** | 26.19/25.58/26.19%; **26.19%** | 5/5/5; 253/239/244 |

## Diagnostic profile: serialization and browser pipeline (pre-optimization)

After the distributed synthetic-tail fixture was introduced, the isolated profiler completed all ten captures: `startup-including-initial-autosave`, pan, wheel, drag, and delayed autosave at 174 and 5,024 items. The startup capture label is intentional: the initial 450 ms autosave debounce may fire inside the startup view-readiness window, so this profile can include initial autosave serialization as well as startup work. Trace positions are taken from the raw `traceClockMs` clock, not capture-relative `startMs`. The reviewed harness revision was verified with `npm run profile:perf` (1/1, ten captures); this profile-harness fix changed no production source. These are diagnostic captures, not benchmark timings. They ran in headless Microsoft Edge 156.0.4314.58 on the same single Windows host described above, with CDP V8 CPU sampling and Chromium timeline tracing. Sampling and tracing add overhead; never compare these durations directly with the uninstrumented benchmark. The raw `.cpu-profile.json`, `.trace.json`, and `profile-summary.json` artifacts are ignored under `test-results/performance-profiles/`.

Source-map inspection of the production bundle attributed the dominant sampled compression work to LZ-String `_compress`. At 5,024 items, sampled `_compress` self-time was approximately 210 ms during startup, 225 ms during pan, 256 ms during wheel zoom, 191 ms during drag, and 223 ms during the delayed autosave phase. A main-thread `localStorage.setItem` of 339,923 characters took about 0.8 ms. JavaScript dominates the sampled CPU work; React/DOM work also grows with item count. Trace summaries showed about 14–66 ms of style/layout work and 12–30 ms of paint work, but those event durations are nested and overlap, so the totals must not be added or read as wall-clock time.

At the time of this pre-optimization profile, `src/app/App.jsx` eagerly computed `saveText` with `encodeSave(game)` on every game update even while Save & Restore was closed. The autosave effect separately serialized/compressed the state after its 450 ms debounce. The source profile identified duplicate main-thread compression as a fix candidate. That serialization work has since been addressed and verified; see the separate [distributed-fixture post-serialization retest](2026-11-03-browser-scaling-distributed-retest.md). The subsequent frame-bounded camera/culling attempt is summarized in the separate [camera retest report](2026-11-03-frame-bounded-camera-culling.md).

The trace labels and sampled frames were mapped back to source through the production source maps. Treat that mapping as attribution to source locations, not exact function wall time. This profiling result is one host, one viewport, one headless Edge version, and instrumented runs; it explains likely cost but does not change the uninstrumented benchmark's timing table or the NO-GO decision.

## Decision and next work

The original clustered-fixture benchmark returned **NO-GO** for increasing content with the current renderer. Its starting view grew from 465.3 ms at 174 items to 4,029.3 ms at 5,024 (8.66x), and mounted 99.52% of the 5,024-item save despite only 27.46% of world area being visible. Its pan p95 rose 41.4x (33.4 to 1,383.4 ms) and wheel-zoom p95 rose 38.0x (50 to 1,899.9 ms). At 5,024 items, median dropped-interval rates were 81.25% for pan and 60% for wheel zoom; a single pan action recorded a 2,333 ms long task. In the full-world view, the 5,024-item wheel action had a 1,549.9 ms median p95 interval (31.0x the 174-item value), and every measured interval exceeded 50 ms. These are clustered-fixture baseline measurements; the separate distributed-fixture retest is in [`2026-11-03-browser-scaling-distributed-retest.md`](2026-11-03-browser-scaling-distributed-retest.md).

The sparse calibration view remains structurally effective (8 mounted nodes at every size), but at 5,024 its wheel and drag interactions still show 149.9 ms and 216.6 ms median p95 intervals, respectively. This indicates that visible-node count alone does not describe the full interaction cost; profile the state update, culling, and rendering path before choosing a remedy. The grid data also becomes increasingly concentrated: at 5,024, 36 occupied cells have p95 density 721 and maximum density 1,068.

The serialization follow-up has been implemented and met its focused performance goal. The distributed-fixture retest reduced start-view occupancy and confirmed compression no longer runs on the main thread during ordinary pan, wheel, drag, or autosave flows, but full-world interaction still failed the renderer gate. The later frame-bounded camera/culling attempt also failed the same-host pan/wheel performance gate; see its separate report. Keep the content-scaling NO-GO in force while further renderer work is evaluated; do not expand content toward 2,500 or 5,000 until same-host comparison and an independent human playthrough support a go decision. These timings are from one host, headless Edge, one viewport, and a single browser configuration; test other hardware before making broad performance claims.

The raw machine-readable output was written by the harness to the ignored artifact `test-results/performance-benchmark/browser-scaling-results.json`. This report preserves the clean run's three measured trials and summaries. The complete game, chapter ending, and independent human playtest are not verified by this benchmark.
