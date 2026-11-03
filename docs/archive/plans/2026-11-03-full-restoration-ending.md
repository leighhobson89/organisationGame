# Plan: Full Restoration and Ending

**Status:** Complete and reviewed on 2026-11-03. The derived completion rules, accessible Engine presentation, focused regressions, documentation, and review are complete. Archived at `docs/archive/plans/2026-11-03-full-restoration-ending.md`. The separate human playthrough and content-expansion gate remains active.

## Goal

Complete the current laboratory when its existing content is fully organized and solved. Present an accessible final Palimpsest Engine demonstration with congratulations and completion statistics, then let the player continue exploring the completed laboratory.

This milestone uses the existing `ITEMS`, `COLLECTIONS`, `PUZZLES`, destinations, progress, and save data. It adds no entities, collections, destinations, progression content, or save-schema fields.

## Completion contract

Add the pure derived completion helpers in `src/game/domain/completion.js`. Both helpers receive `expectedItemIds`, derived from the frozen current 174-item catalog, so completion is checked against the complete current catalog even if runtime state is missing an item:

- `isGameComplete({ items, progress, collections, puzzles, expectedItemIds })` returns true only when all three conditions hold:
  1. The expected item catalog is nonempty, and every ID in `expectedItemIds` is present in current item state with `validation === 'correct'`, placed in a destination, and filed at its own `correctDestinationId`. A missing expected ID blocks completion.
  2. Every collection in the supplied `COLLECTIONS` catalog is complete according to its actual member item placement and correct destination filing. Derive this from item state using the existing collection-completion rule; `progress.completedCollectionIds` alone cannot establish completion.
  3. Every puzzle ID in the supplied `PUZZLES` catalog appears in `progress.solvedPuzzleIds`.
- `getCompletionStats({ items, progress, collections, puzzles, notebook, expectedItemIds })` returns counts and percentages derived only from the supplied current state and catalogs. It must not mutate inputs or add persisted completion state. The stable result fields are `restoredItemCount`, `totalItemCount`, `restorationPercent`, `completedCollectionCount`, `totalCollectionCount`, `solvedPuzzleCount`, `totalPuzzleCount`, `notebookDiscoveryCount`, and `ownedSkillCount`.
- `getCompletionStats` counts restored items with the same correct-file predicate used by completion, sets `totalItemCount` to the expected catalog size (174), and computes `restorationPercent` from that total. Expected IDs missing from current state count as unrestored and remain in the total. Derive collection counts from actual member placement, not `progress.completedCollectionIds`. Read owned skills from `progress.ownedSkills`, and report zero notebook discoveries when the optional `notebook` argument is missing. `isGameComplete` does not depend on notebook or owned-skill counts.
- Derive the result from game state on render/update. Do not add a completion boolean, timestamp, score, or milestone field to the save schema.

## Final Engine presentation

- Show the final Engine demonstration and congratulations only when `isGameComplete(...)` is true.
- Present a concise set of defensible completion statistics from `getCompletionStats`: restored/total items, restoration percentage, completed/total collections, solved/total puzzles, notebook discoveries, and owned skills. Derive all values from the existing item, progress, notebook, and catalog state. Do not invent elapsed time, accuracy, extra content, or a score.
- Provide an explicit **Continue exploring** action. Continuing must return control to the same completed laboratory without resetting items, progress, selection, or camera.
- Keep the demonstration and congratulations keyboard-operable, expose an accessible heading and announcement, manage focus into and out of the presentation, and honor reduced-motion settings. The Engine demonstration must remain understandable without animation or color alone.
- Do not introduce new destinations, cards, collection rewards, puzzle content, or changes to existing completion/reward behavior.

## Resolved narrative interpretation

The user chose to resolve the ending from existing clues. Use only these short beats in the final Engine presentation:

1. **The replay:** “The Engine did not ring the bell. It replayed an impression left by the Chaos Event.”
2. **The witnesses:** “The Professor and Elian were both witnesses to the event.”
3. **The recording choice:** “The Professor's unsent apology points to his choice to keep the Engine recording through an unstable echo, so the event's account would survive.”
4. **The limit of the record:** “The recovered material does not establish what originally triggered the Chaos Event.”

Do not state a cause for the Chaos Event or invent Elian's response. Present the Engine as a witness and recorder, not as the cause of the event. The narrative dependency is resolved, but the narrative beats still require review against the existing authored clues during implementation review.

## Focused validation plan

The Test Engineer added focused regressions against this API before implementation. Both the pre-fix baseline and final focused results are recorded here.

### Unit tests

Test file: `tests/unit/game-foundation/completion.test.mjs`

Planned focused command:

~~~sh
node --test --test-isolation=none tests/unit/game-foundation/completion.test.mjs
~~~

The current unit tests cover:

- Completion is false for an empty item list, any workspace/scratch-pad item, misfiled or invalid item, or item filed to a destination other than its canonical `correctDestinationId`.
- Completion is false when any ID in the 174-ID `expectedItemIds` catalog is missing from current item state; stats still count the missing item in `totalItemCount` and as unrestored.
- Collection completion and completed collection stats are derived from actual collection member placement. A stale `completedCollectionIds` entry cannot satisfy a collection with missing or incorrectly filed members.
- Completion is false when any `PUZZLES` catalog ID is absent from `solvedPuzzleIds`; it becomes true only when every item, collection, and puzzle condition is satisfied.
- Completion stats return the stable fields `restoredItemCount`, `totalItemCount`, `restorationPercent`, `completedCollectionCount`, `totalCollectionCount`, `solvedPuzzleCount`, `totalPuzzleCount`, `notebookDiscoveryCount`, and `ownedSkillCount`; they handle zero denominators safely and do not mutate input objects or arrays.

Historical initial unit baseline: `node --test --test-isolation=none tests/unit/game-foundation/completion.test.mjs` failed with 0 passed and 1 file failure because `src/game/domain/completion.js` did not yet exist (14.396 ms). The expanded pre-fix unit run then completed with **4/6 passing and 2/6 failing**. Those two intended failures concerned missing collection progress-marker behavior and ignored `expectedItemIds`. The tests also cover a record that says `validation: 'correct'` but is filed somewhere other than its canonical destination.

### Browser E2E tests

Test file: `e2e/lab/full-restoration-ending.spec.js`

Planned focused command:

~~~sh
npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js
~~~

The current E2E file contains one complete-flow case: the player starts from an almost-complete existing save, uses keyboard-accessible Item Finder selection to file the final item correctly, verifies the final Engine sequence, approved narrative beats, and stats, activates Continue exploring by keyboard, and confirms the completed state still loads. The narrative assertions cover all four approved beats: the Engine replayed an impression left by the Chaos Event rather than ringing the bell; the Professor and Elian witnessed the event; the Professor's unsent apology points to his choice to record through an unstable echo so the account would survive; and the recovered material does not establish the Event's original trigger. They must not imply a cause or invent Elian's response. The E2E checks that completion retains the v3 schema and does not add a completion field.

The expanded four-case E2E run passed **4/4 before code fixes**. Separate historical one-test runs each failed 1/1 at an intended regression:

- **Initial structural baseline:** `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js` failed 1/1 after the final correct filing because the `completion-sequence` presentation was absent (6.8 seconds Playwright duration, about 9 seconds wall time). The test names the `completion-sequence` and stats test IDs for the implementation contract.
- **Narrative-copy baseline:** after the structural ending UI existed but before the story copy edit, the same command failed 1/1 at the first clue-based narrative matcher. Generic Engine copy did not connect the replay to the Chaos Event (about 6.8 seconds Playwright duration, about 8.96 seconds wall time). The later regression now checks the four approved evidence-bounded beats recorded above.

Final focused verification and review:

- `node --test --test-isolation=none tests/unit/game-foundation/completion.test.mjs`: **6/6 passed**.
- `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js`: **4/4 passed**, including all three negative completion states (misfiled item, incomplete collection, and unsolved puzzle).
- `npm run build`: **passed with Vite 8.3.5**.
- Post-implementation Code Reviewer: **no actionable findings**.
- Full test suite: **not run**.

Additional acceptance coverage:

- App-level E2E incomplete variants do not show the final Engine demonstration or congratulations: all puzzles solved with one item misfiled; all items filed except that a collection is incomplete from its actual member state; and all collections/items complete with one catalog puzzle unsolved.
- Completion unit coverage includes a missing expected item ID and verifies that it blocks completion and remains included as unrestored in the 174-item stats denominator.
- Collection unit coverage proves a stale `completedCollectionIds` entry cannot replace correct placement of every collection member.
- A fully complete fixture reveals the final Engine presentation once and reports values matching the exact fixture.
- Keyboard users can reach the presentation, hear/inspect its status, activate Continue exploring, and return to the same completed laboratory with state intact.
- Reduced-motion mode retains the complete message and the Engine's meaningful visual state without requiring motion.
- Autosave/reload remains compatible with the existing schema and does not depend on a newly persisted completion flag.

The E2E fixture uses existing IDs and catalogs and must not add content. The Test Engineer has recorded the focused red baseline before implementation.

### Code review findings

The review requirements are captured in the contract and focused regressions above: derive collection completion from the actual placement of its members rather than `completedCollectionIds`; use the frozen current 174-item catalog as `expectedItemIds` for both completion and stats; block completion when any expected ID is absent; and count every missing expected ID as unrestored while retaining it in the total-item denominator. The three app-level incomplete E2E variants verify the final UI is gated by item filing, collection membership, and puzzle completion together. Post-implementation review found no actionable issues.

## Scope boundaries

- No new entities, item families, collections, puzzles, destinations, rewards, or story clues.
- No save-schema change or migration.
- No alteration of current item IDs/order, placement/capacity rules, collection progression, puzzle unlock/reward behavior, or autosave/recovery semantics.
- Keep `docs/plans/browser-scaling-playtest-gate.md` active. This ending milestone does not complete the independent human playthrough or authorize content expansion.
- The focused unit and E2E checks and production build passed. The full test suite was not run; do not run it without the approval required by `AGENTS.md`.

## Handoff and acceptance

The Architect owned the completion contract and narrative resolution; the Test Engineer added focused regressions; JavaScript, React, and CSS Developers implemented the domain and presentation; the Code Reviewer checked derived-state correctness, accessibility, persistence compatibility, and narrative claims; the Documentation Specialist recorded the results.

- [x] Resolve and record the user's answer to the final narrative question before adding ending claims.
- [x] Add the derived completion helpers and unit tests without changing persistence.
- [x] Add the accessible Engine demonstration, congratulations statistics, and continue-exploring behavior.
- [x] Preserve the existing save schema; verify completion does not add persisted completion state.
- [x] Pass focused unit and E2E checks, production build, and review.
- [x] Preserve the active human-playthrough/content-expansion gate in `docs/plans/browser-scaling-playtest-gate.md`.

Archived after implementation, narrative review, focused verification, and documentation were complete. The independent two-chapter human playthrough remains open; content expansion remains gated.
