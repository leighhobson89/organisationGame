# Plan: Preserve Earned Chapter Progress on Reload

## Goal

Keep one-time collection rewards and puzzle unlocks as permanent earned
milestones when a player later moves an item out of a completed collection.
The current item placement remains the source of truth for current collection
status, destination badges, the chapter count, and full-laboratory completion.
The Engine's `InventionCore` assembly indicator is only a boolean stage fallback,
not a current restoration count; preserve it from earned milestone history so a
later move does not rewind it.

If a member is moved after completing a chapter-two collection, autosave and
reload must preserve the moved placement, earned reward, and unlocked puzzle
without treating the save as corrupt. The Notebook and progress UI must make
the earned reward distinct from the collection's current placement state.

## State and UI boundaries

- Keep `progress.completedCollectionIds` as the existing one-time reward
  history. Preserve earned skill points and `unlockedPuzzleIds` after a later
  placement change; do not add a save field or schema version.
- Derive current collection completion from item validation and actual
  destination placement, not from the historical reward marker. Apply that to
  `WorldViewport`/`DestinationCard` completion badges, `NotebookPanel` current
  completion and summary, and the App header chapter count.
- `InventionCore.completedCollections` only drives its boolean assembly/stage
  fallback, not a visible count. Keep that cue tied to earned history so it
  does not disappear after a collection member is moved.
- Puzzle availability and solve prerequisites must follow earned collection
  markers and recorded unlocked puzzle IDs, not require members to remain in
  their destinations after the reward was earned.
- Keep full-restoration eligibility derived from actual current item placement,
  current collection completion, and solved puzzles. This change must not relax
  the ending criteria.

## Persistence invariants

- Normalization accepts an earned chapter-two collection marker whose items
  were subsequently moved; preserve the move and milestone on reload.
- Continue rejecting a fully filed chapter-two collection with no earned
  completion marker.
- Continue rejecting a chronology unlock or solve without all required earned
  collection markers, and reject a solved puzzle that is not unlocked.
- Preserve unknown-ID, slot, placement, capacity, and other strict v3
  validation. Add no content, dependency, save field, or schema version.

## Verification scope

- `v3 normalization preserves earned chapter markers and chronology unlock
  after an item returns to the workspace` verifies a moved member normalizes
  while the three historical collection IDs, chronology unlock/solve, and item
  workspace placement remain intact.
- `v3 normalization rejects a fully filed chapter collection without its
  earned marker` keeps strict validation for a currently complete chapter
  collection whose reward marker is absent.
- `v3 normalization rejects a chronology unlock without all earned prerequisite
  markers` rejects an unlock with one chapter prerequisite marker missing.
- The E2E extends the existing v2 migration/three-collection/chronology
  journey. After the three collections and chronology are completed, it moves
  one chapter-two member to workspace, waits for autosave, reloads, and checks
  that the placement, reward markers, skill points, unlocked/solved chronology,
  Engine stage, and progress UI survive without a recovery notice. It checks a
  2/3 current chapter count, the now-incomplete destination badge, the Notebook
  row `7 of 8 correctly placed. Reward earned; refiling needed.`, the `2
  restored` current collection summary, and continued chronology-panel access.
- `node --test --test-isolation=none --test-name-pattern="v3 normalization preserves earned chapter markers|v3 normalization rejects a fully filed chapter collection|v3 normalization rejects a chronology unlock" tests/unit/game-foundation/game-systems.test.mjs`
  is the focused unit command. Its red baseline was 2 passed and 1 failed as
  expected: the current validator rejects the moved member with `Saved progress
  for bell-before-dawn does not match its filed objects.`
- `npx playwright test e2e/lab/research-chapter.spec.js --workers=1 --grep "v2 migration preserves the old placement and the chapter gate, compass, and chronology can be completed"`
  is the focused browser command. Its red baseline failed at the new current
  chapter count assertion: expected `Research collections: 2 of 3`, received
  `Research collections: 3 of 3`. The initial sandbox browser spawn returned
  EPERM; the focused command completed with process access.
- Run the focused normalization tests and research-chapter E2E, production
  build, and code review. Do not run the full suite without user approval.

## Final verification (2026-11-03)

- Normalization regressions passed 3/3, including acceptance of an earned
  collection after a member moves and strict rejection of a fully filed
  collection without its marker or a chronology unlock without all earned
  prerequisites.
- Completion unit tests passed 6/6. The focused research-chapter E2E passed
  1/1 after completing all three chapter-two collections and chronology,
  moving one member, autosaving, and reloading. It verified persistence of the
  moved placement and earned milestones, the 2/3 current chapter count, an
  incomplete destination badge, continued chronology access, Engine state,
  and Notebook's visible and accessible **Reward earned; refiling needed**
  status with a `2 restored` current-placement summary.
- An additional reviewer-driven red baseline asserted visible Notebook text:
  `expect(collectionRow).toContainText('Reward earned; refiling needed.')`.
  It failed 1/1 because visible text was `⌑The Bell Before Dawn7 / 8 filed`,
  while the accessible name already included the reward/refiling status. The
  final E2E verifies both forms.
- `npm run build` passed with Vite 8.3.5 (59 modules); Code Reviewer found no
  remaining issues; `git diff --check` was clean. The full suite was not run.
