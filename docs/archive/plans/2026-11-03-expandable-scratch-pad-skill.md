# Plan: Expandable Scratch-Pad Skill

**Status: Complete (2026-11-03).** Implementation, focused verification, code
review, and documentation are complete. The independent human-playtest and
content-expansion gate remains open.

## Goal

Add a permanent purchasable Workshop Skill that increases both existing scratch pads from 24 to 30 contained object slots. The extra row uses the current board footprint and gives the player more room to compare and assemble hypotheses.

## Decisions and boundaries

- Add a one-point passive skill named **Modular Worktables** with ID `modular-worktables` and effect `expand-scratch-pad-capacity`.
- Keep the existing 5-column layout and add a sixth row. The current 540 × 530 world-space pads contain all six rows (the last 62px-tall item ends 24px above the board bottom); do not move, resize, or restyle the pads.
- Derive expanded pad definitions from `progress.ownedSkills`; capacity stays 24 until the skill is owned, then becomes 30 on both pads. Preserve all existing slot indices and positions.
- Store ownership in the existing `progress.ownedSkills` list. Keep save schema v3 and preserve all old v1/v2/v3 saves. A v3 save can use slots 24–29 only when it owns the skill; otherwise reject those slots during normalization. Legacy v1/v2 migration continues to allow only its existing legacy skill IDs.
- Show the skill as a passive owned capability, not an activation button. Its purchase confirmation should state that six more spaces are available on each table. The pad header and accessible name should communicate current occupancy and capacity.
- Do not add a pad, object/content, destination, story beat, or gameplay automation. Keep the independent human-playthrough/content-expansion gate open.

## Implementation

1. Add the passive skill metadata and a single helper that returns the base or expanded scratch-pad definitions from owned skill IDs.
2. Use the derived definitions consistently in the application placement flow, Item Inspector target list, world rendering/jump navigation, and save normalization.
3. Normalize and validate the owned skill IDs before validating target slots. Pass the effective definitions into target-slot validation so v3 imports accept slots 24–29 only with the skill and retain strict rejection without it. Keep v1/v2 migration on its existing legacy skill whitelist.
4. Update the Skills panel so passive skills have an owned status instead of a nonfunctional Activate button. Give the purchase handler a specific capacity-upgrade toast. Add capacity text to scratch-pad visual and accessible summaries.
5. Add focused unit coverage for both pads' 30 contained positions, last-slot allocation, full-capacity rejection, batch movement, and save normalization with/without the skill. Add a focused browser regression for purchase, visible/accessibility feedback, moving an item into a newly available slot, autosave/reload persistence, and the unchanged 24-slot behavior without ownership.
6. Update the game vision, architecture, vertical-slice, roadmap, and testing guide; request code review; archive the plan when verification and documentation are complete.

## Test plan

### Unit coverage

Add focused cases to `tests/unit/game-foundation/game-systems.test.mjs` for the
derived scratch-pad definitions and placement/save rules:

- Without `modular-worktables`, both pads retain capacity 24 and their current
  slot indices and positions. With the skill, both expose 30 slots; verify each
  of the 30 item positions, including the final row, remains inside the
  unchanged 540 × 530 board.
- Allocate through slot 29, reject a new item after all 30 slots are occupied,
  and allow a same-pad move or batch allocation only when the effective
  capacity permits it. A rejected over-capacity batch must leave every item
  placement unchanged.
- Normalize v3 saves with and without the owned skill: slots 24–29 are accepted
  only with the skill, while unowned out-of-range slots and capacities above 30
  are rejected. Existing first-24 indices remain stable.
- Keep v1/v2 migration restricted to its legacy skill-ID whitelist and verify
  old saves retain their placements and indices without gaining the new skill.

### Browser coverage

Add `e2e/lab/scratch-pad-capacity.spec.js` to cover the player flow and
save boundary:

- With no owned skill, both pads expose 24-space capacity; dropping a new item
  onto a full pad leaves it loose and reports that the pad is full.
- With one insight point, purchase **Modular Worktables**. The confirmation
  says each table gains six spaces, and the skill appears as owned/passive with
  no Activate control. The expanded pad's header and accessible name announce
  its current count and capacity; unit tests verify the derived capacity and
  layout for both pads.
- Start with 24 items on one pad, buy the skill, then move a loose item into the
  newly available slot. Verify the saved v3 ownership and slot 24 survive
  autosave and reload, and the world count remains 174.
- Reject a v3 import that uses slot 24 without the skill; confirm the current
  live state and backup remain unchanged. Unit tests also reject slots 24–29
  without ownership and out-of-range slots beyond the expanded capacity.

Focused commands:

```sh
npm run test:game
npm run test:e2e -- --workers=1 e2e/lab/scratch-pad-capacity.spec.js e2e/lab/organising-loop.spec.js
```

Historical red baseline before implementation: the game-systems unit run
reported 55 tests, with 53 passing and the two new capacity/save-normalization
cases failing as expected. The focused browser run failed both scratch-pad
capacity cases at the missing capacity summary. The final focused results are
recorded below.

## Verification

- Run the game-systems unit tests, including scratch placement and save-normalization cases.
- Run the focused new scratch-pad skill browser spec and the existing organising-loop regression using the commands above.
- Run `npm run build` and `git diff --check`.
- Do not run the full suite without user approval.
- Confirm old save fixtures without the skill preserve their slot indices, v3 saves with the skill reload in slots 24–29, invalid unowned/over-capacity imports are rejected without changing the live save, and the current 174-item count is unchanged.

## Risks

- Save normalization currently checks scratch-pad slots before it constructs normalized progress. Reorder or factor only enough validation to derive owned skills first; do not weaken unrelated save validation.
- Existing app flows pass the base `SCRATCH_PADS` constant in several places. Any missed call site could show capacity 30 while rejecting moves, or accept moves the save normalizer rejects. Search for every use and pass the same derived definitions through each runtime path.
- Keep the new row within current board bounds at the actual item dimensions; verify every slot rather than relying only on the aggregate grid count.

## Completion and verification (2026-11-03)

- `npm run test:game`: 55/55 passed.
- `npm run test:e2e -- --workers=1 e2e/lab/scratch-pad-capacity.spec.js e2e/lab/organising-loop.spec.js`: 12/12 passed.
- `npm run build`: passed with Vite 8.3.5.
- Code Reviewer found no actionable issues; `git diff --check` was clean.
- The implementation stores ownership in the existing v3 `progress.ownedSkills`
  field, keeps the v3 schema and 174-item catalog unchanged, permits slots 24–29
  only when the skill is owned, and retains the v1/v2 legacy skill whitelist.
- The full test suite was not run. The independent human-playtest and
  content-expansion gate remains open.
