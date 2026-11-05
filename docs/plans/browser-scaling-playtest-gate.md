# Plan: Browser Scaling and Two-Chapter Playtest Gate

**Status:** Active. Focused software checks indicate readiness to begin the human test; the independent two-chapter playthrough and feedback remain open. Keep this plan active and content expansion gated until the playtest is reviewed. See the [Phase 1 readiness checklist](../PHASE_1_HUMAN_TESTING.md).

Serialization optimization, frame-bounded camera/culling, and the hybrid Canvas overview implementation are complete and reviewed. The clustered baseline, post-serialization distributed retest, post-camera retest, and hybrid overview retest remain separate reports. The hybrid overview meets the same-host full-world interaction gate. The two-chapter manual playthrough and independent human feedback remain open, so content expansion remains gated and this plan stays active.

## Goal and boundary

Establish browser-based performance evidence for the current 174-item game and representative larger v3 saves before expanding content. Keep the opt-in serial Edge regression in `performance/browser-scaling-regression.spec.js`, selected by `playwright.performance.config.js` and `npm run test:e2e:performance`. Its separate `testDir` keeps it outside default E2E discovery. Do not add a full performance suite to ordinary E2E runs.

Benchmark v3 saves with 174, 500, 1,000, 2,500, and 5,024 items. Preserve authored entities and valid v3 state while filling larger fixtures with deterministic generated items. Sample both a sparse remote camera view and a full-world stress view.

## Measurements and method

For each size and trial, measure startup, the populated sparse-camera view, and the full-world view in separate fresh browser contexts. Use the same app build, viewport, and cache policy for every context, with equivalent fixtures, so static-asset/cache and session state are comparable and prior view interactions do not carry over.

The preliminary 8m24s benchmark is invalid because it used the old empty sparse camera and a shared browser context. Exclude its measurements from comparisons and reports. The clean clustered-fixture baseline uses the populated calibration-only sparse view, fresh contexts, and one warm-up followed by three measured trials; retain it in `docs/performance/2026-11-03-browser-scaling.md`.

A subsequent partial run is also excluded from final comparisons: the 174, 500, 1,000, and 2,500 cases and the 5,024 warm-up passed, but the 5,024 populated-sparse warm-up failed viewport readiness because the page initially measured 1000 by 700 before `ResizeObserver` settled. The corrected clean clustered run after the readiness fix completed; the build passed and the benchmark passed 1/1 in about 8.3 minutes. The distributed-fixture run after serialization passed build and benchmark 1/1 in 4.5 minutes; the later frame-bounded camera retest passed build and benchmark 1/1 in 4.7 minutes. Their values are preserved in distinct reports: `docs/performance/2026-11-03-browser-scaling-distributed-retest.md` and `docs/performance/2026-11-03-frame-bounded-camera-culling.md`. Do not blend either retest into the clustered baseline.

Record for each size and view:

- First-interactive time, with the start and ready signals defined in the harness.
- Total entity count, mounted item DOM count, and mounted-to-total ratio.
- Long-task count and duration, observed across each interaction action and its settle window.
- Animation-frame interval p50, p95, p99, and drop rate while panning, wheel-zooming, and dragging one item. Include the action plus the 220ms settle window; define a dropped interval consistently with the 50ms threshold.

Run one warm-up followed by three serial Edge trials on the same host for each size and view. Compare the 5,024-item results with the 174-item baseline from that host; investigate ready-time or normal-view p95 ratios above 2×. Record hardware-sensitive timings rather than hard-failing on universal millisecond cutoffs. Interaction acceptance requires no repeatable interaction long task over 50ms.

Record machine/OS, CPU and memory where available, Node version, Edge version/channel, Playwright version, viewport dimensions, device scale factor, and results per trial. Keep Node generation/index timings labeled separately; they are not browser rendering or interaction measurements.

At a 1440×900 viewport and scale 0.5, record the starting-camera mounted fraction as an occupancy diagnostic. Compare it with the uniform world-area estimate; investigate occupancy above twice that estimate (approximately 56% of N). This diagnostic informs the interpretation of culling ratios and is not a universal timing threshold.

The current opt-in structural/interaction regression covers both 174 and 5,024 items. Its populated sparse view uses camera `{panX: -1840, panY: -964, scale: 2.5}`, centered around the calibration cards. It asserts that `calibration-card-01` is visible and mounted, and that the mounted `.lab-object` count is greater than zero and no more than 10 (also fewer than the total). It pans from empty space and checks that the `.world-scene` transform changes, then wheel-zooms out from maximum scale and checks that `.zoom-readout` changes. A real `dragTo` moves `calibration-card-01` to `cabinet-calibration`. After the drag, it verifies autosave preserves the exact ordered ID list, total count, unique IDs, and filed target placement. It then reloads the same v3 save at 1440×900 with camera `{panX: 0, panY: 0, scale: 0.2}` and verifies the Canvas represents every saved entity, ordinary DOM overlays stay within 64, the displayed count and saved IDs remain exact, and canvas pixels carry family and invalid-placement cues.

Focused structural regression history: the original `npm run test:e2e:performance -- --workers=1` checked full-world DOM mounting; after serialization optimization it passed 3/3, and after frame-bounded camera/culling the complete opt-in regression group passed 7/7 in 32.2 seconds. The hybrid-renderer regression now checks Canvas representation and the DOM-overlay cap. Its focused subset passed 7/7; the complete opt-in performance E2E file passed 12/12 in 44.9 seconds. The production build passed, code review found no actionable issues, and the full suite was not run. Browser regression timings are not first-interactive or interaction benchmark measurements.

## Scaling decision

**Renderer interaction gate: PASS on the measured host. Content expansion: still gated pending the human playthrough.** In the hybrid overview run, full-world pan/wheel p95 was 16.73/16.80 ms at 174 items and 16.70/16.73 ms at 5,024 items (0.998x/0.996x). Full-world views represented all entities on Canvas with 64 DOM overlays; measured pan/wheel intervals and long tasks did not exceed 50 ms. The complete per-trial evidence is in `docs/performance/2026-11-03-hybrid-canvas-overview.md`. These are hardware-sensitive measurements from one host, not universal timing guarantees.

The frame-bounded camera/culling results above were a historical NO-GO that motivated the hybrid Canvas overview; their trial evidence remains in `docs/performance/2026-11-03-frame-bounded-camera-culling.md`. The latest interaction benchmark passes, but the two-chapter journey still needs an independent human playthrough before the content-scale decision changes. Preserve camera transforms, hit-testing, drag/drop, zoom, save/reload, and keyboard access in future work.

Report occupancy at the 1440×900, 0.5-scale starting camera against the approximately 56%-of-N diagnostic. Record cold/warm differences and variability; do not present three trials as a broad device benchmark. Performance results do not replace a manual usability review.

## Manual playthrough and reports

Play through both research chapters from a fresh save: organize the first collection, solve its puzzle, use the Resonance Lens, complete the three chapter-two collections, try the Missing Member Compass, solve the chronology puzzle, and inspect the notebook and Chronology Wheel stage. Include pointer and keyboard movement, pan/zoom, save/reload, and any confusion, friction, or clipping. Record environment, steps, observations, issues, and follow-ups in `docs/playtests/2026-11-03-research-chapters.md`.

Keep the clustered baseline at `docs/performance/2026-11-03-browser-scaling.md` and record each later fixture/renderer state in its own dated report. The hybrid report includes the methodology, host/browser, trials, Canvas representation and overlay counts, and interaction-gate result. Update architecture, roadmap, testing, and README only with conclusions supported by the reports.

## Roles and review

There is no dedicated performance or playtesting role. Use the Architect to review measurements and the scaling decision, implementation specialists to build the isolated harness, the Test Engineer to review the browser regression, and the Code Reviewer to inspect isolation and measurement validity. An agent-led playthrough is useful exploratory evidence, but it is not independent human feedback; label it honestly and leave human playtesting open if no independent participant is available. There is also no dedicated accessibility specialist; record accessibility observations within the closest available review.

## Acceptance criteria

- [x] Opt-in serial Edge performance runs are excluded from the default E2E suite and reproducibly generate valid fixtures at all five sizes.
- [x] The 174/5,024 regression checks the displayed count, a populated sparse view with the known calibration card visible and 1–10 mounted objects, exact ordered/unique IDs after autosave, pan, wheel zoom, pointer drag, saved placement, and full-world Canvas representation plus overlay cap after reload at scale 0.2.
- [x] Three measured trials after one warm-up are reported with machine/browser/viewport metadata and requested metrics across the three views.
- [x] The clustered baseline, distributed-fixture serialization retest, frame-bounded camera retest, hybrid overview gate PASS, one-host limitations, and human-playthrough follow-up are documented separately.
- [ ] Complete and review the two-chapter playthrough; an agent-led session remains separate from independent human feedback.
- [x] The benchmark report and exploratory playtest report are recorded; the playtest report remains incomplete pending the full manual journey and independent feedback.
- [ ] Complete and review the human playthrough before changing the content-scale decision. The complete story and ending remain outside this milestone.

The user deferred the independent human playtest for now. Record any later playthrough when it is scheduled; this deferral does not close the gate.

Run only focused checks during development. Ask for approval before running the full test suite, as required by `AGENTS.md`. Archive this plan only after implementation, measurements, playthrough/review, and documentation are complete.
