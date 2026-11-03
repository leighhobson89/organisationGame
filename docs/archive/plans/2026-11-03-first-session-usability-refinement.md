# Plan: First-Session Usability Refinement

**Status:** Complete and reviewed on 2026-11-03. The first-session layout and Inspector refinements, focused regressions, and documentation are complete. Archived at `docs/archive/plans/2026-11-03-first-session-usability-refinement.md`. The separate human-playthrough/content-expansion gate remains active.

## Goal

Improve the first-session layout of the existing 174-item fresh laboratory by distributing generated filler more evenly within its existing family clusters, avoiding full occlusion, and keeping the Inspector's **Move item** action visible at the 1084 × 827 playtest viewport while item details scroll.

This is a usability refinement to existing content and controls. It does not expand the game or change the content-scaling decision.

## Scope and invariants

- Adjust only the seeded workspace layout of generated filler in a newly created game, in `src/game/content/generateLab.js`. Distribute filler more evenly within the existing family clusters, reduce unintended item-on-item overlap, and avoid fully obscuring loose items while preserving authored clusters, including the calibration folio and the three chapter collection groups.
- Keep the layout deterministic for a given seed, within world bounds, and compatible with the existing hit testing and interaction model.
- Preserve the 174-item new-game count and the exact content order, IDs, families, clues, and destinations. Do not change authored item positions or any generated content fields as part of the layout adjustment; limit generator changes to fresh filler positions.
- Update any intentional fresh-layout generation fingerprint or fixed-position expectation affected by the new filler coordinates. Historical saved positions and migration compatibility are not fingerprint fixtures to rewrite.
- Keep the Inspector's Move item button visible and reachable at a CSS viewport of 1084 × 827 while long item details can scroll. Preserve the existing item selection, focus, keyboard, and move behavior.
- In `src/ui/ItemInspector.jsx` and `src/styles/app.css`, separate scrollable item details from the move controls as needed so the target selector and **Move item** button remain visible and usable.
- Do not regenerate or rewrite saved item coordinates. Existing saves must retain their item `position` and `previousWorkspacePosition` through load, migration, and save operations supported by the current application.
- Keep the save schema, collection progression, puzzle behavior, and all other game progression unchanged.
- Add no items, collections, destinations, clues, or other content. Do not change or close the human-playtest/content-expansion gate.

## Acceptance criteria

- For the deterministic default 174-item new game, the focused generator regression measures overlap and occlusion against the Architect's baseline of 259 axis-aligned overlapping pairs among 174 loose items, including one fully covered pair. Excluding authored-authored pairs, the layout must have at most 80% of baseline overlaps (no more than 207 pairs) and no fully occluded item. Final result: one overlapping pair and zero fully occluded items. The regression also verifies that authored cluster coordinates are unchanged, generated positions remain in bounds, and repeated calls with the same seed produce the same layout.
- A content-contract regression verifies the new game still has exactly 174 items with the same ordered IDs, families, clues, and correct destinations as before. Only fresh filler positions may differ.
- At a 1084 × 827 CSS viewport, the selected item's Inspector shows the **Move item** control fully within the viewport. When item details exceed the available panel height, the details can scroll without clipping or hiding the action.
- At a short mobile viewport of 390 × 480 CSS pixels (width within the ≤720px responsive breakpoint), long Inspector details can scroll while the **Move item** control remains fully within both the Inspector panel and viewport. The regression also covers 390 × 600, where the current control fits.
- Keyboard navigation can reach and activate **Move item** while the Inspector is in its scrollable state; the move still uses the existing destination selection and placement rules.
- Existing saved item coordinates, including previous workspace positions where present, remain unchanged after loading and saving. Current save schema and progression state remain unchanged.
- The independent human playthrough remains incomplete and content expansion remains gated until the separate active playtest plan is completed.

## Focused validation plan

The Test Engineer added the generator, desktop, and mobile regressions before implementation. Their paths, focused commands, and red baselines are recorded below, followed by final focused results.

### Generator unit regression

Planned coverage:

- Check seeded 174-item reproducibility, world bounds, calibration-card clearance, the ordered content fingerprint, and overlap excluding authored-authored pairs.
- Require no more than 80% of the 259-pair overlap baseline (≤207 pairs) and zero fully occluded items; confirm authored cluster coordinates remain unchanged.
- Snapshot the ordered item count, IDs, families, clues, and correct destinations to prevent content changes.

Test path: `tests/unit/game-foundation/game-systems.test.mjs`.  
Focused command: `node --test --test-isolation=none tests/unit/game-foundation/game-systems.test.mjs`.

Pre-implementation red baseline: **45 tests total; 44 passed and 1 failed** in 261.1 ms. The sole failure is the intended overlap gate: the current 259 pairs exceed the 207-pair maximum. The content fingerprint, 174-item seed reproducibility, multi-seed bounds, authored group positions, and calibration clearance checks pass.

### Browser usability regression

Planned coverage:

- At a 1084 × 827 CSS viewport, assert details can scroll, then measure the **Move item** button's bounds before clicking and verify neither the Inspector nor page has scrolled, so Playwright auto-scroll cannot hide a clipped action.
- Once the visibility check passes, exercise the move and verify the autosaved destination position and `previousWorkspacePosition` remain correct.
- Add a short-height mobile case at 390 × 480 CSS pixels using a long Inspector detail. Measure the **Move item** control against the panel and viewport before clicking; confirm detail scrolling does not clip the action or cause page/Inspector scrolling to fake visibility. Also confirm the control fits at 390 × 600.

Test path: `e2e/lab/world-and-save-recovery.spec.js`.  
Focused command: `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "Move item stays visible at 1084"`.

Mobile test title: `Move item stays inside the Inspector at 390×480 before auto-scroll`.  
Focused mobile command: `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "Move item stays inside the Inspector at 390"`.  
Pre-implementation mobile red baseline: **1/1 failed** at the pre-click bounds assertion for 390 × 480. Inspector bounds were top 243.45, bottom 414, left 10, right 380; Move control bounds were top 402.58, bottom 436.58, left 29, right 361. The control extended 22.58 px below the Inspector panel while detail scrolling and both Inspector `scrollTop` and page scroll remained at 0; it was still within the 480 px viewport. The test keyboard-selects the item through Finder before measuring. At 390 × 600, the same control passed.

Pre-implementation red baseline: **1 test; 1 failed** in 1.5 seconds at the pre-move geometry assertion. The button's bottom edge was at y=1005.25, beyond the Inspector/panel bottom at y=811. The no-scroll assertions passed before the geometry failure. The saved destination position and `previousWorkspacePosition` assertions occur after the red assertion and were not reached in this baseline run.

### Final verification and diagnostics

- `node --test --test-isolation=none tests/unit/game-foundation/game-systems.test.mjs`: **46/46 passed**. The fresh 174-item layout now has **1 overlapping pair** versus the 259-pair baseline and **zero fully occluded items**.
- The combined focused E2E cases in `e2e/lab/world-and-save-recovery.spec.js` passed **2/2**: the Move action is visible at 1084 × 827 and at the mobile 390 × 480 viewport. At 390 × 600, it also fits. The browser cases verify visibility before click/auto-scroll and the move/save-position behavior.
- `npm run build`: **passed with Vite 8.3.5**.
- Code Reviewer: **no actionable findings**.
- Full test suite: **not run**.
- A single-run diagnostic generated 5,000 items in **1,564 ms before the placement-attempt cap and 5 ms after it**. This is a single-run diagnostic, not a benchmark; do not compare it with the multi-trial generation/index benchmark.

## Handoff and completion

The Architect defined this bounded usability scope from an agent-led playtest that observed heavily clumped filler and an Inspector Move action requiring scroll at 1084 × 827. That exploratory observation is not independent human feedback and does not close the separate playtest gate. The Test Engineer owns the focused generator and browser regressions. The implementation should adjust only fresh filler placement and Inspector layout/scroll behavior. The Code Reviewer checks the content contract, save-position preservation, responsiveness at the specified viewport, and keyboard access. The Documentation Specialist records final results after implementation and review.

- [x] Add the generator and desktop browser regressions and record their pre-implementation red baselines; paths, commands, coverage, and results are listed above.
- [x] Add the short-height 390 × 480 mobile regression and record its pre-implementation red baseline.
- [x] Reduce fresh filler overlap while retaining authored clusters and the existing content contract; finish at one overlapping pair and no full occlusions.
- [x] Keep **Move item** visible and keyboard-operable at 1084 × 827 and 390 × 480 while details scroll.
- [x] Verify existing save positions, save schema, and progression remain unchanged.
- [x] Pass focused regressions, build, and code review.
- [x] Keep `docs/plans/browser-scaling-playtest-gate.md` active until the independent human playthrough is completed and reviewed.

Archived after implementation, focused verification, review, and relevant documentation were complete. The independent two-chapter human playthrough remains incomplete and content expansion remains gated.
