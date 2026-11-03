# Testing Guide

Use the narrowest test layer that can verify the behavior. Unit tests cover rules, calculations, validation, and state transitions; browser end-to-end (E2E) tests cover user-visible journeys and browser integration.

## Current commands

Run focused checks during normal development:

~~~sh
npm run test:game
node --test --test-isolation=none tests/unit/game-foundation/completion.test.mjs
node --test --test-isolation=none tests/unit/game-foundation/audio-events.test.mjs
node --test --test-isolation=none tests/unit/game-foundation/user-preferences.test.mjs
node --test --test-isolation=none tests/unit/game-foundation/web-audio-adapter.test.mjs tests/unit/game-foundation/user-preferences.test.mjs
node --test --test-isolation=none tests/unit/game-foundation/manual-saves.test.mjs
node --test --test-isolation=none --test-name-pattern="Aether Wayfinder" tests/unit/game-foundation/game-systems.test.mjs
node --test --test-isolation=none --test-name-pattern="World atlas" tests/unit/game-foundation/world-atlas.test.mjs
node --test --test-isolation=none --test-name-pattern="pinch zoom" tests/unit/game-foundation/camera-pinch.test.mjs
npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js e2e/lab/organising-loop.spec.js
npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js
npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js
npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js
npm run test:e2e -- --workers=1 e2e/lab/filed-note-title.spec.js
npm run test:e2e -- --workers=1 e2e/lab/unfinished-collection-navigation.spec.js
npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js
npm run test:e2e -- --workers=1 e2e/lab/scratch-pad-capacity.spec.js e2e/lab/organising-loop.spec.js
npm run test:e2e -- --workers=1 e2e/lab/aether-wayfinder.spec.js
npm run test:e2e -- --workers=1 e2e/lab/world-atlas.spec.js
npm run test:e2e -- --workers=1 e2e/lab/touch-navigation.spec.js
npx playwright test e2e/lab/audio-settings.spec.js e2e/lab/preferences.spec.js e2e/lab/manual-saves.spec.js --workers=1
npm run test:e2e:performance -- --workers=1
npm run build
~~~

The unit commands are:

- `npm run test:game` runs the focused game systems file, including staged batch-slot allocation, selected-occupant vacating, input immutability, duplicate/unknown ID handling, insufficient-capacity rejection, and Modular Worktables capacity/slot/save-normalization coverage.
- `node --test --test-isolation=none tests/unit/game-foundation/completion.test.mjs` checks the derived full-restoration contract and completion statistics.
- `node --test --test-isolation=none tests/unit/game-foundation/audio-events.test.mjs` checks the transient event publisher, subscription behavior, and gameplay event contract.
- `node --test --test-isolation=none tests/unit/game-foundation/user-preferences.test.mjs` checks versioned accessibility preference normalization and storage behavior.
- `node --test --test-isolation=none tests/unit/game-foundation/web-audio-adapter.test.mjs tests/unit/game-foundation/user-preferences.test.mjs` checks all 12 audio event cue mappings, gesture unlock, discarded muted/suspended events, rate limits, cleanup/failure isolation, and backward-compatible `soundEffectsEnabled` preference behavior.
- `node --test --test-isolation=none tests/unit/game-foundation/manual-saves.test.mjs` checks the three manual slot helpers, envelope validation, legacy Slot 1 handling, confirmations, and storage failures.
- `node --test --test-isolation=none --test-name-pattern="Aether Wayfinder" tests/unit/game-foundation/game-systems.test.mjs` checks the skill's v3 catalog ownership and confirms the v1/v2 legacy skill whitelist remains unchanged.
- `node --test --test-isolation=none --test-name-pattern="World atlas" tests/unit/game-foundation/world-atlas.test.mjs` checks the atlas projection and inverse mapping, centered letterboxing, out-of-bounds clamping, camera viewport clipping, and fixed-grid density aggregation through 5,024 items.
- `node --test --test-isolation=none --test-name-pattern="pinch zoom" tests/unit/game-foundation/camera-pinch.test.mjs` checks midpoint anchoring, distance-ratio scaling without input mutation, configured scale clamping, and invalid distance, midpoint, camera, and zoom-bound handling.
- `node --test --test-isolation=none tests/unit/game-foundation/autosave-coordinator.test.mjs` runs focused worker autosave-coordinator checks.
- `npm test` runs the full Node unit suite.

The E2E commands are:

- `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js` runs the second-chapter migration and progression journeys, plus responsive Palimpsest Engine jump framing on desktop and a narrow viewport.
- `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js` runs the original collection and puzzle journey plus accessible batch movement, Canvas overview selection, mixed per-item validation, the 40-item selection cap, and atomic capacity rejection.
- `npm run test:e2e -- --workers=1 e2e/lab/scratch-pad-capacity.spec.js e2e/lab/organising-loop.spec.js` checks the Modular Worktables purchase and passive owned state, purchase feedback, the filled pad's updated accessible capacity summary, movement into slot 24 with autosave/reload, unchanged 24-space behavior without ownership, invalid-import rejection preserving live and backup saves, and the existing organising loop. The unit coverage checks expanded capacity and slot geometry on both pads.
- `npm run test:e2e -- --workers=1 e2e/lab/aether-wayfinder.spec.js` checks skill availability, eligibility for workspace, scratch-pad, and misfiled items, canonical destination focus at a readable minimum scale, the seven-second guided marker and its clearing conditions, no item/progression mutation, accessible item-and-destination naming and status, and OS/user reduced-motion behavior.
- `npm run test:e2e -- --workers=1 e2e/lab/world-atlas.spec.js` checks Atlas toggle and landmarks, bounded density and camera outline, pointer/keyboard recentering, event isolation from world items, Atlas/Finder mutual exclusion, mobile geometry, reduced motion, camera autosave/reload without Atlas save fields, and bounded rendering at 5,024 items.
- `npm run test:e2e -- --workers=1 e2e/lab/touch-navigation.spec.js` checks one-finger empty-space pan, two-finger pinch around a moving midpoint, continuous pan after one pinch finger lifts, item-drag cancellation when a second finger arrives, and separate pan and pinch camera autosave/reload.
- `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js` checks the complete ending flow and three incomplete states.
- `npm run test:e2e -- --workers=1 e2e/lab/preferences.spec.js` checks persistent Settings behavior, keyboard access, responsive text scaling, and effective reduced motion.
- `npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js` checks Inspector/Finder/Instruments panel transitions, selection retention, Finder focus handling, pointer/keyboard isolation, and wheel/touch scrolling.
- `npm run test:e2e -- --workers=1 e2e/lab/filed-note-title.spec.js` checks full-title reveal on hover, focus, and selection; camera zoom sizing and pointer continuity; the viewport-edge Inspector fallback; and unchanged item, camera, and save geometry (4 focused cases).
- `npm run test:e2e -- --workers=1 e2e/lab/unfinished-collection-navigation.spec.js` checks live correct-placement counts, focuses the first unfinished member (including a misfiled member despite stale completion progress), removes completed collections from quick navigation, and preserves fixed world-jump options.
- `npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js` checks wrapped toolbar geometry and readable controls at 390 × 480 and 320 × 480, preserves the desktop single row at 1440 × 900, and asserts the world hint and selection toast do not overlap the toolbar or each other.
- `npx playwright test e2e/startup.spec.js --reporter=line` checks the accessible startup diagnostic when the app entry module is served with an unsupported JSX MIME type.
- `npx playwright test e2e/lab/manual-saves.spec.js --workers=1` checks new slot envelopes, corrupt-slot isolation, overwrite/delete/restore confirmations, reload/restore, focus return, pre-restore backup, and preferences isolation. Legacy raw Slot 1 compatibility is covered by the unit test, not this E2E file.
- `npx playwright test e2e/lab/audio-settings.spec.js e2e/lab/preferences.spec.js e2e/lab/manual-saves.spec.js --workers=1` checks opt-in sound settings persistence, trusted-gesture Web Audio activity, preference behavior, and that audio settings remain isolated from game saves.
- `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js e2e/lab/world-and-save-recovery.spec.js e2e/lab/research-chapter.spec.js e2e/lab/full-restoration-ending.spec.js` verifies gameplay event emissions across drag/drop, placements, progression, and ending activation, including complete-save import without replaying final activation.
- `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js` runs world interaction and persistence regressions.
- `npm run test:e2e:performance -- --workers=1` runs the opt-in 174/5,024-item browser structural and interaction regression. This performance test directory is excluded from the default E2E configuration.
- `npm run test:e2e -- --workers=1 e2e/lab/world-ground-appearance.spec.js` checks the static survey-floor layers, world/camera behavior, accessible hiding, stacking, and unchanged item count.
- `npm run test:e2e` runs the full browser E2E suite. Get user approval before running a full suite, as required by `AGENTS.md`. The same approval rule applies to `npm test` when it is being run as the full unit suite.

The build command is `npm run build`.

## Browser harness

Playwright starts Vite through its configured web server, waits for `http://127.0.0.1:5173`, then shuts the server down after the run. It reuses an existing server outside CI. Browser tests run headlessly by default using the Microsoft Edge channel. Traces are retained on failure, screenshots are captured only on failure, and video is disabled.

Playwright writes the HTML report to `playwright-report/` and test artifacts to `test-results/`. These generated directories are ignored by git.

## Opt-in browser scaling benchmark

~~~sh
npm run test:perf
~~~

This command builds the app, then runs the serial headless Edge benchmark for 174, 500, 1,000, 2,500, and 5,024-item v3 saves. It uses one warm-up plus three measured trials in three fresh browser contexts/views per size and takes several minutes. It is intentionally isolated from default E2E discovery. The machine-readable output is `test-results/performance-benchmark/browser-scaling-results.json`; clustered, distributed, frame-bounded, and hybrid Canvas runs have separate reports under `docs/performance/`.

`npm run profile:perf` runs the isolated ten-capture CDP diagnostic profile. Its traced/sampled durations are diagnostic and must not be compared to the unprofiled benchmark.

The original clustered-fixture benchmark passed 1/1 after its build. After serialization optimization, a separate distributed-fixture benchmark/build passed 1/1 in 4.5 minutes. The frame-bounded camera/culling benchmark/build then passed 1/1 in 4.7 minutes on the same host but failed its interaction gate: the 5,024-item pan/wheel p95 ratios were 26.33x/25.67x the 174-item baselines. The later hybrid Canvas overview run cleared that gate; it is a separate report and does not replace the earlier results. Do not combine the clustered and distributed reports into a same-fixture comparison.

World-ground treatment verification (2026-11-03): the floor-appearance E2E passed 1/1, the organizing-loop E2E passed 9/9, the full opt-in performance E2E passed 12/12, and `npm run test:perf` passed 1/1 after its build in 1.9 minutes. The sparse-view assertions require all eight calibration IDs and allow 8–10 mounted items because the camera query correctly includes a nearby overscan card. Full-world 5,024-item pan/wheel/drag p95 was 16.8/16.7/16.8 ms with no intervals over 50 ms or long tasks; the dense starting view had 50.1 ms wheel p95 and isolated over-50 ms intervals in 2/3 trials. See [the dated floor-treatment report](performance/2026-11-03-world-ground-treatment.md) for the method, table, and caveats. Independent human feedback remains open; the full test suite was not run.

## Runtime and locked package versions

The package does not declare a top-level Node engine field. The locked Vite 8.3.5 dependency requires Node `^20.19.0 || >=22.12.0`; Playwright 1.63.0 requires Node `>=20`. The project lockfile currently resolves React and React DOM 19.3.1, LZ-String 1.5.0, Vite 8.3.5, and Playwright 1.63.0. Keep the lockfile in sync when dependencies change.

## Current recorded results

Second-chapter milestone verification on 2026-11-03:

- `npm run test:game`: 41/41 passed.
- `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js e2e/lab/organising-loop.spec.js`: 4/4 passed.
- `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js`: 20/20 passed.
- `npm run build`: passed with Vite 8.3.5.
- Reviewer re-review found no remaining blockers.
- The full test suite was not run.
- `npm run test:e2e:performance -- --workers=1`: 2/2 passed for the 174- and 5,024-item structural cases (reported test durations 3.4s and 12.6s; these are not performance measurements).
- Original clustered-fixture `npm run test:perf`: build passed and benchmark passed 1/1 in about 8.3 minutes; the result is retained in the clustered baseline report.

The focused browser coverage includes v2-to-v3 migration and recovery, preservation of existing placements, the chapter collection gate, Missing Member Compass behavior without item mutation, chronology completion, notebook and Engine stage updates, rejected invalid imports, and the original organising loop.

Chronology save/reload follow-up (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js --grep "v2 migration preserves the old placement"` passed 1/1 after adding a browser reload to the completed chronology journey. It verifies the v3 autosave restores all 174 items, all three chapter collections and their filed placements, the solved chronology and Chronology Wheel, notebook discovery, the purchased Missing Member Compass, the migrated item's position/placement/rotation, and unchanged item, progress, notebook, and camera state. The notebook panel also shows **The Last Bell** after reload. The default sandbox attempt stopped with `spawn EPERM`; rerunning the focused command with process access passed. `npm run build` passed with Vite 8.3.5, and Code Reviewer found no actionable issues. No runtime code changed and the full test suite was not run. The latest CUA session's manual post-chronology reload remains unverified, and the independent human playthrough is still open.

World and save-recovery focused regression (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js` passed 23/23. Coverage includes pointer/Escape cancellation; drag, pan, and keyboard placement; scratch-pad and destination capacity; Inspector Move visibility at 1084 × 827 and 390 × 480; pan/zoom; valid export/import; rejected imports preserving current and autosaved state; v1 migration; malformed v3 slot validation; and preserving a corrupt startup autosave. This was a focused spec run, not the full test suite; the full suite was not run.

Invention stage assembly visuals (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js e2e/lab/organising-loop.spec.js` passed 8/8. Coverage includes fresh-game Dormant state; a clipped Engine edge remaining mounted when it partially overlaps the viewport; and a centered saved Chronology Wheel stage with the crystal retained, a decorative `aria-hidden` wheel, and computed wheel animation duration at most 0.01 ms when the E2E emulates the OS reduced-motion preference. Separately, the saved user reduced-motion preference disables animations. The run also covers the existing migration, puzzle progression, and persistence journey. The initial centered/partial-overlap runs failed because the Engine was culled; the correction supplies a top-left AABB to `isNearViewport()` while retaining the center for `.invention-anchor`. `npm run build` passed with Vite 8.3.5, and Code Reviewer re-review found no actionable issues. The full suite and human playthrough were not run.

Responsive Engine jump (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js` passed 7/7, including the desktop 100% centered Engine frame and the fully visible fitted frame at 390 × 480. `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The full test suite and independent human playthrough were not run.

Restored badge encoding (2026-11-03): the red baseline for `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js --grep "recover a misfiled card"` failed 1/1 because the rendered badge text was garbled instead of `✓ Restored`; after the fix, the same focused command passed 1/1. `npm run build` passed with Vite 8.3.5, and Code Reviewer found no actionable findings. The full test suite was not run.

Accessible multi-selection and atomic batch movement (2026-11-03): `node --test --test-isolation=none tests/unit/game-foundation/game-systems.test.mjs` passed 49/49, covering staged unique slots with vacated selected occupants, immutable inputs, duplicate/unknown ID handling, and insufficient-capacity rejection without partial allocation. `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js` passed 9/9, covering keyboard/pointer selection and movement, single and mixed correctness, exactly-once collection reward/puzzle unlock, Canvas-only pointer selection without dragging, carrying and keyboard-deselecting the inspected item, the 40-selection cap, and over-capacity rejection preserving items/progress/save and selection. The tests confirm the total Canvas DOM overlay cap remains 64. `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The full test suite and independent human playthrough were not run; the active human-playtest/content-expansion gate remains open.

The clustered baseline, post-serialization distributed retest, and post-camera retest are documented separately in `docs/performance/2026-11-03-browser-scaling.md`, `docs/performance/2026-11-03-browser-scaling-distributed-retest.md`, and `docs/performance/2026-11-03-frame-bounded-camera-culling.md`. The Node generation/index microbenchmark in `docs/ARCHITECTURE.md` measures data/index work only and does not measure browser frames or interaction behavior.

Serialization milestone focused results: coordinator unit checks 11/11, focused world/save-recovery E2E 21/21, structural browser regression 3/3, profile run 1/1 with ten captures, and distributed-fixture benchmark/build 1/1 in 4.5 minutes. The profiler found no `_compress` work in pan, wheel, drag, or autosave captures; startup showed `_decompress` only, and the autosave storage write was about 0.4 ms for roughly 340 KB. These results meet the serialization goal, not the separate renderer scaling gate. See the [distributed retest report](performance/2026-11-03-browser-scaling-distributed-retest.md) for details.

Frame-bounded camera/culling results: `npm run build` passed; `npm run test:e2e:performance -- --workers=1` passed 7/7 in 32.2 seconds; `npm run test:perf` passed build and benchmark 1/1 in 4.7 minutes. Its performance gate failed; full-world p95 grew 26.33x for pan and 25.67x for wheel from 174 to 5,024 items, with 5,024-item interval-over-50ms rates of 83.87%/60% and 23/2 long tasks. See `performance/2026-11-03-frame-bounded-camera-culling.md` for that historical result.

Hybrid Canvas overview results: render-policy and hit-test unit tests passed 5/5; the focused browser regression passed 7/7; the complete opt-in performance E2E file passed 12/12 in 44.9 seconds. `npm run test:perf` built the app and passed 1/1 in 1.9 minutes. At 5,024 items, the full-world Canvas represented every item while 64 ordinary DOM overlays remained mounted. Pan and wheel p95 were 16.70/16.73 ms versus 16.73/16.80 ms at 174 items; no full-world pan/wheel interval or long task exceeded 50 ms. Code review found no actionable issues. The one-host renderer interaction gate passes, but the separate human playthrough remains incomplete. The full test suite was not run. See `performance/2026-11-03-hybrid-canvas-overview.md`.

Full-restoration ending results: `node --test --test-isolation=none tests/unit/game-foundation/completion.test.mjs` passed 6/6; `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js` passed 4/4, including the misfiled-item, incomplete-collection, and unsolved-puzzle variants; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable findings. The expanded pre-fix unit run passed 4/6 and failed 2/6 on collection progress-marker behavior and ignored `expectedItemIds`; an earlier unit attempt stopped at the missing completion module. Historical single-case E2E baselines each failed 1/1: the structural run lacked the ending presentation, and the later narrative-copy run did not connect the replay to the Chaos Event. The expanded four-case E2E run passed 4/4 before code fixes. The full test suite was not run. The ending derives completion from the frozen current 174-item catalog, actual collection member placement, and all catalogued puzzles; it adds no save-schema field. The separate human-playthrough/content-expansion gate remains active.

Professor recording-choice ending follow-up (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js` passed 5/5; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The full test suite was not run. The focused browser check verifies the explicit choice to keep recording through an unstable echo while preserving the unknown Event trigger and unresolved Elian response.

Startup module-load diagnostic (2026-11-03): `npx playwright test e2e/startup.spec.js --reporter=line` passed 2/2, including the intercepted `text/jsx` module response and normal startup. `npm run build` passed with Vite 8.3.5, and Code Reviewer found no actionable findings. The full test suite was not run.

Resonance Lens description (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js --grep "recover a misfiled card"` passed 1/1. The case checks that the Lens description matches its collection/family highlighting behavior and retains coverage that the Lens highlights a related card without moving it or changing the save. `npm run build` passed with Vite 8.3.5; Code Reviewer found no remaining actionable issues. The full test suite was not run.

First-session usability refinement results: `node --test --test-isolation=none tests/unit/game-foundation/game-systems.test.mjs` passed 46/46; generated-layout overlap fell from 259 axis-aligned pairs to 1, with zero fully occluded items. The combined focused Inspector E2E run passed 2/2 at 1084 × 827 and 390 × 480, verifying the Move control before auto-scroll and preserving the move/save-position flow. Case-specific commands are `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "Move item stays visible at 1084"` and `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "Move item stays inside the Inspector at 390"`. `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues; the full test suite was not run. A single-run 5,000-item generation diagnostic took 1,564 ms before the placement-attempt cap and 5 ms after; this is a diagnostic, not a benchmark. The two usability issues from the agent-led exploratory session now have automated verification, but the independent two-chapter human playthrough remains incomplete and content expansion remains gated.

Asset-free audio event hooks results: `node --test --test-isolation=none tests/unit/game-foundation/audio-events.test.mjs` passed 6/6; the focused four-file E2E command above passed 33/33; `npm run build` passed with Vite 8.3.5; Code Reviewer found no remaining actionable issues. The global `subscribeGameAudioEvents(listener)` bus publishes 12 stable gameplay events to current subscribers and discards events when there are no subscribers; it does not queue or replay. Completed-save import does not emit final activation, while genuine completion emits once. The hooks add no audio assets/playback, preferences, or save fields. The full test suite was not run, and the separate human-playthrough/content-expansion gate remains active.

Persistent accessibility preferences results: `node --test --test-isolation=none tests/unit/game-foundation/user-preferences.test.mjs` passed 9/9; `npm run test:e2e -- --workers=1 e2e/lab/preferences.spec.js` passed 5/5, including the 390 × 480 layout, root/body computed font sizes at 125%, and live OS reduced-motion changes; `npm run build` passed with Vite 8.3.5. Code Reviewer confirmed both findings resolved with no remaining issues. Preferences use a separate versioned localStorage record; they do not change the game save schema. The full test suite was not run.

Manual save slots results: `node --test --test-isolation=none tests/unit/game-foundation/manual-saves.test.mjs` passed 9/9, including legacy raw Slot 1 recognition; `npx playwright test e2e/lab/manual-saves.spec.js --workers=1` passed 2/2, covering new slot envelopes, corrupt-slot isolation, confirmations, preferences isolation, focus return, reload/restore, and the pre-restore backup; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The initial Playwright baseline was blocked by Windows `spawn EPERM` before tests; the final focused E2E run succeeded with process-spawn access. The full test suite was not run.

Optional audio playback results: `node --test --test-isolation=none tests/unit/game-foundation/web-audio-adapter.test.mjs tests/unit/game-foundation/user-preferences.test.mjs` passed 19/19; `npx playwright test e2e/lab/audio-settings.spec.js e2e/lab/preferences.spec.js e2e/lab/manual-saves.spec.js --workers=1` passed 9/9; `npm run build` passed with Vite 8.3.5; Reviewer re-review found no actionable issues. The adapter covers all 12 existing transient events with bounded synthesized cues. Audio starts only after a trusted pointer or keyboard gesture when the opt-in `soundEffectsEnabled` preference is enabled; its default is false, muted/suspended events are discarded without replay, and disabling or teardown cleans up playback and subscriptions. The preference extends the separate version 1 accessibility-preferences record and does not enter game saves. The initial focused E2E baseline was blocked by Windows `spawn EPERM` before execution; the final retry passed. Automated wiring is verified, while a human listening-quality check remains for broader release polish. The full test suite was not run.

Item Finder panel coordination results: `npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js` passed 8/8, covering panel visibility and selected-item retention, keyboard focus transfer/restoration, Finder pointer and keyboard isolation, and wheel/touch scrolling without world movement. `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. A fresh-origin CUA check at `http://127.0.0.1:5176` exposed Finder/Inspector overlap before the fix; the correction was verified by focused E2E, not by a new full manual playthrough. The full test suite was not run, and the independent human-playthrough gate remains active.

Filed note title reveal results: `npm run test:e2e -- --workers=1 e2e/lab/filed-note-title.spec.js` passed 4/4, covering hover/focus/selection, pointer continuity and drag prevention, 2.5x camera readability, the viewport-edge Inspector fallback, and unchanged item/camera/save geometry. The panel-coordination E2E passed 8/8; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The full test suite was not run, and the independent human-playthrough gate remains active.

Frame-bounded camera/culling and hybrid Canvas implementations are reviewed and archived under `docs/archive/plans/`; their regressions remain opt-in under the performance E2E command. The separate human-playthrough gate remains active in `docs/plans/browser-scaling-playtest-gate.md`.

Selected-item evidence comparison (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js --grep "multi-selection"` passed 3/3. Coverage verifies semantic Family and Clue terms with exact values for two selected items before a successful group move, all 40 comparison rows at the cap, scrollable details with the group Move control still available after scrolling, and deselection. `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable findings. The full suite was not run and the independent human playthrough remains open.

Unfinished-collection navigation (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/unfinished-collection-navigation.spec.js` passed 3/3. It verifies counts from canonical placements and live updates after filing, first-misfiled-member focus despite stale completion progress, omission after collection completion, and preservation of starting-area, Engine, destination, and scratch-pad jumps. `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The full suite was not run; independent human feedback and content-expansion gates remain open.

Modular Worktables scratch-pad capacity (2026-11-03): `npm run test:game` passed 55/55. The grouped command `npm run test:e2e -- --workers=1 e2e/lab/scratch-pad-capacity.spec.js e2e/lab/organising-loop.spec.js` passed 12/12. Unit coverage verifies both pads' six-row bounds, slot 29 allocation, full-capacity rejection, atomic batch allocation, v3 slots 24–29 only with ownership, and the legacy v1/v2 skill whitelist. Browser coverage verifies the one-point passive purchase, installed state without an Activate control, the filled pad's updated accessible capacity summary, moving an item into slot 24 and restoring it after reload, and the 24-slot limit and state-preserving rejection of an unowned-slot import. The item count remains 174. `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues; `git diff --check` was clean. The full suite was not run, and the independent human-playtest/content-expansion gate remains open. See the [archived plan](archive/plans/2026-11-03-expandable-scratch-pad-skill.md).

Mobile world toolbar (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js` passed 3/3 at 390 × 480, 320 × 480, and 1440 × 900. Coverage checks that the wrapped toolbar, controls, selection toast, and persistent item count stay visible; the location selector remains readable; and the hint/toast/toolbar do not overlap in the normal and selection states. `npm run build` passed; final review found no actionable findings. The full test suite was not run. The separate human-playthrough/content-expansion gate remains active. See the [archived plan](archive/plans/2026-11-03-mobile-world-toolbar.md).

Aether Wayfinder (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/aether-wayfinder.spec.js` passed 12/12; `npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js` passed 8/8; `node --test --test-isolation=none --test-name-pattern="Aether Wayfinder" tests/unit/game-foundation/game-systems.test.mjs` passed 2/2; `npm run build` passed with Vite 8.3.5. The E2E covers workspace/scratch-pad/misfiled eligibility, destination focus and readable scale, the seven-second guide and clearing conditions, non-mutation, accessible item-and-destination naming/status, and OS/user reduced-motion behavior. Code Reviewer found no actionable findings. The full suite was not run; the independent human-playtest/content-expansion gate remains open. See the [archived plan](archive/plans/2026-11-03-aether-wayfinder-skill.md).

Clockwork Atlas (2026-11-03): `node --test --test-isolation=none --test-name-pattern="World atlas" tests/unit/game-foundation/world-atlas.test.mjs` passed 6/6; `npm run test:e2e -- --workers=1 e2e/lab/world-atlas.spec.js` passed 11/11; `npm run build` passed with Vite 8.3.5. Coverage verifies projection and clipping, bounded density at 5,024 items, camera recentering with zoom preserved, pointer isolation, keyboard/focus behavior, Atlas/Finder mutual exclusion at 390 × 480, mobile geometry, reduced motion, and saved-camera behavior without Atlas fields. Code Reviewer found no actionable findings. The full suite was not run; the independent human-playtest/content-expansion gate remains open. See the [archived plan](archive/plans/2026-11-03-clockwork-atlas.md).

Touch pinch navigation (2026-11-03): `node --test --test-isolation=none --test-name-pattern="pinch zoom" tests/unit/game-foundation/camera-pinch.test.mjs` passed 4/4; `npm run test:e2e -- --workers=1 e2e/lab/touch-navigation.spec.js` passed 6/6; `npm run build` passed with Vite 8.3.5. The browser cases cover empty-space pan, moving-midpoint pinch anchoring, lift-to-pan, item-drag cancellation without changing placement, and independent pan and pinch autosave/reload. Code Reviewer found no actionable issues. The full suite was not run. The user deferred the independent human playtest for now; its gate remains open and content expansion remains gated. See the [archived plan](archive/plans/2026-11-03-touch-pinch-navigation.md).

## Test design and maintenance

Keep tests deterministic and independent. Prefer role-, label-, and accessible-name locators in E2E tests. Assert visible outcomes, wait for meaningful conditions, and avoid arbitrary sleeps. When a defect depends on browser behavior, add a focused browser regression; otherwise use the headless unit layer.

When behavior changes, add or update focused regression coverage and update this guide if commands, runtime constraints, harness configuration, or artifact locations change.
