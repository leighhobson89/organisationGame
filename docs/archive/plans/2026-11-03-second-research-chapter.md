# Plan: Second Research Chapter

**Status:** Completed for the second research chapter milestone on 2026-11-03. This plan does not mark the full game, large-scale performance, or ending as complete.

**Test status:** Focused tests, build, and reviewer re-review are complete with no remaining blockers. The full suite was not run.

## Goal and boundaries

Add a playable second research chapter to the existing continuous laboratory. Preserve the original 150 canonical items and their IDs, definitions, and behavior. Append 24 stable authored items across three eight-item collections. The slice ends after a chronology puzzle and the second Palimpsest Engine stage.

Keep the chapter data-driven and compatible with current collection, destination, notebook, skill, puzzle, and save systems. Do not alter the original collection reward or silently move items.

## Content and interaction

- Add three collections, each containing eight authored items. Across each collection include two `handwritten-note`, two `experiment-record`, two new `map-fragment`, and two new `formula-card` items. Use stable IDs and authored dates, clues, and relationships that support one unambiguous chronology solution.
- Give each collection a dedicated eight-slot destination. Use a contained 4×2 layout and place the three destinations in a separate, reachable area of the current world without overlapping existing destinations, scratch pads, or controls. New items begin loose in deterministic world positions.
- Complete all three chapter collections to unlock one chronology puzzle. Validate an explicit ordering of the dated events; on success, add related notebook/story discoveries and advance the Palimpsest Engine to its second stage. The puzzle stays locked until all three collections are complete.
- Add one missing-member skill to the existing skills UI. When used with an incomplete chapter collection, it highlights one authored member that is not correctly filed. It must never move, file, validate, or otherwise mutate item placement. Keep the player responsible for the sort.
- Add concise notebook entries for collection discoveries and the chronology solution. Keep story content attached to the objects and discoveries rather than adding a new dialogue system.

## Save schema and migration

Bump the canonical save schema from v2 to v3. Normalize and validate a v2 save using its existing rules, then migrate it by preserving the currently supported v2 fields: every existing item and its exact placement, position, rotation, validation, and ID; progress; notebook discoveries; camera state; selected item and content seed when present; and invention stage. Append the 24 new authored items exactly once in their deterministic workspace positions and initialize the new chapter as locked with no chapter discoveries. Do not relocate or re-slot existing items.

Persistent settings are not modeled by the current normalizer and remain outside this milestone; add them in future work if the game introduces persistent settings.

- Preserve the raw valid v2 autosave in recovery before its first v3 autosave overwrite, using the existing protected migration path.
- Keep imports atomic: migrate and validate the candidate before updating live state, autosave, or backup. A rejected v3 import changes none of them.
- Make v2-to-v3 and repeated v3 normalization idempotent. Keep the existing v1 migration behavior working through the canonical migration path.
- The current v2 item limit is 5,000. Raise the v3 limit to at least 5,024 so migrating a valid maximum-size v2 state can append all 24 chapter items without dropping existing entities; test this boundary without treating it as a performance benchmark.

## Source and review boundaries

- `src/game/content/`: authored family definitions, 24 item records, three collections, destinations, chronology puzzle, and missing-member skill metadata.
- `src/game/domain/`: chapter completion, puzzle unlock/solve rules, and the non-mutating skill result.
- `src/game/persistence/`: v3 normalization, v2 migration, recovery, and import atomicity.
- `src/ui/` and `src/styles/`: chapter destinations/items, puzzle, notebook discoveries, skill controls, and family presentation.

No dedicated narrative, puzzle-design, playtesting, or accessibility role is available. Use the Architect for chapter and puzzle structure; JavaScript, React, and CSS Developers for implementation in their areas; the Test Engineer for focused regressions; and the Code Reviewer for migration, interaction, and performance review. Record the scope of those reviews without implying specialist playtesting.

## Focused verification

### Focused commands and exact specs

The name-filtered unit command isolates the chapter and migration contracts; it produced the initial red baseline recorded below. Final focused verification used:

~~~sh
npm run test:game
npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js e2e/lab/organising-loop.spec.js
npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js
npm run build
~~~

Initial red baseline command (2026-11-03): `node --test --test-isolation=none --test-name-pattern="chapter content|new game includes|chronology gate|v2 migration appends|v2 maximum-size|v2 autosave" tests/unit/game-foundation/game-systems.test.mjs` ran 6 tests, with 0 passing and 6 failing on absent chapter content, chronology-gate behavior, and v3 migration. The focused research-chapter E2E run failed at the expected fresh-world count: 150 current items instead of 174. An initial sandbox browser spawn returned EPERM; the approved focused rerun completed and produced the reported count failure.

Final verification (2026-11-03):

- [x] `npm run test:game` — 41/41 passed.
- [x] `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js e2e/lab/organising-loop.spec.js` — 4/4 passed.
- [x] `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js` — 20/20 passed.
- [x] `npm run build` — passed with Vite 8.3.5.
- [x] Reviewer re-review — no remaining blockers.
- The full suite was not run; browser scaling and human playtesting remain future work.

Added or adjusted unit specs in `tests/unit/game-foundation/game-systems.test.mjs`:

- `chapter content preserves all 150 canonical objects and appends three deterministic eight-item collections`
- `a new game includes the 24 authored chapter items`
- `chronology gate stays locked until each of the three chapter collections is complete`
- `game state normalization rejects more than the v3 5,024-object limit`
- `v2 migration appends chapter content once and preserves all existing records and game state`
- `v2 maximum-size migration retains all 5,000 old objects and appends 24 chapter objects`
- `loading a v2 autosave preserves its exact raw bytes in recovery before the first v3 save`

The new browser spec in `e2e/lab/research-chapter.spec.js` is:

- `v2 migration preserves the old placement and the chapter gate, compass, and chronology can be completed`

The existing `e2e/lab/organising-loop.spec.js` journey remains a regression guard for the first chapter.
The related `e2e/lab/world-and-save-recovery.spec.js` regression run also passed (20/20).

### Unit regressions completed

- [x] Preserve the original 150 canonical definitions and IDs alongside 24 unique chapter items (174 total in a fresh game), with deterministic placement and the intended two-per-family mix in each collection.
- [x] Give all three destinations eight contained slots and keep collection membership, destination rules, chronology clues, and solution data consistent.
- [x] Keep the chronology puzzle locked until all three collections are complete; record the one-time unlock, reward, notebook clue, and second Engine stage.
- [x] Have the Missing Member Compass identify one loose chapter member without mutating items; return no target for a completed collection.
- [x] Migrate v2 fixtures while preserving supported item records and game state; append the 24 records once, preserve raw v2 recovery data, and keep v3 normalization stable. Include the 5,000-to-5,024-item boundary.
- [x] Reject forged chronology progress and rejected imports without changing live state, autosave, or backup; retain v1-to-v3 migration and v3 round-trip behavior.

### Browser E2E regressions completed

- [x] Load a v2 fixture with changed placements and progress, preserve supported state through v3 migration, append chapter records, and verify raw recovery.
- [x] Complete all three collections through visible controls, check the chronology gate, solve the dated sequence, and observe notebook and Engine updates.
- [x] Use the Missing Member Compass and verify it highlights a member without changing saved item placement.
- [x] Reject a chronology-gate import and confirm live export, autosave, and backup remain unchanged.
- [x] Keep the original organising-loop E2E passing.

Run the focused unit and E2E tests for the chapter during development. Ask for approval before running a full test suite, as required by `AGENTS.md`.

## Acceptance criteria

- [x] A fresh game has the 150 original canonical entities plus 24 new authored entities, with no duplicate IDs and deterministic placement.
- [x] Three eight-item collections span the four specified families and each has its own usable eight-slot destination.
- [x] The chronology puzzle unlocks only after all three chapter collections; solving it records the discoveries and second invention stage once.
- [x] The Missing Member Compass informs the player without changing or filing any item.
- [x] V2 migration preserves all supported fields (including placements, progression, notebook, camera, optional selected item/content seed, and invention stage), appends the chapter exactly once, and safely recovers the raw v2 autosave. Invalid imports do not alter live or stored state. Persistent settings remain future work.
- [x] Focused unit and browser regressions pass, including the original organising-loop journey.

## Explicit exclusions

- Large-scale browser performance scaling and decisions about rendering beyond the current approach.
- Additional chapters, expanded skill or puzzle trees, and large volumes of filler content.
- Full Palimpsest Engine restoration, the complete Chaos Event story, and the ending.
- Dedicated narrative, puzzle, playtest, and accessibility staffing or a formal human playtest within this milestone.
