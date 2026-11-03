# Plan: Navigate to Unfinished Collection Items

**Status:** Complete (2026-11-03). This navigation improvement does not expand the catalog or change the independent-playtest gate.

## Goal

Help players return to unfinished work in the continuous laboratory without hunting for a collection's next item manually.

## Scope

1. Extend the native world jump selector with an option for each incomplete collection, labeled with its correctly filed count and total.
2. Derive count and completion from actual member placement: `validation === 'correct'`, destination placement, and the collection's canonical destination ID. Loose, scratch-pad, and misfiled members remain unfinished even if saved progression flags say otherwise.
3. Selecting a collection centers its first unfinished existing member in authored `itemIds` order at a readable zoom. A misfiled member earlier in that order must be reached before a later loose member.
4. Remove a collection from the unfinished options once all members are correctly filed. Keep the navigation derived and transient; do not add save fields or alter the catalog.
5. Preserve existing starting-area, Engine, destination, and scratch-pad jumps.

## Implementation checklist

- [x] Derive per-collection correct counts and first unfinished members from current item state.
- [x] Add live collection options to the world jump selector and focus the selected member.
- [x] Keep existing jump targets and save data unchanged.
- [x] Complete focused browser verification and production build.
- [x] Update the relevant project documentation and archive this plan after review.

## Verification scope

- Focused E2E in `e2e/lab/unfinished-collection-navigation.spec.js` covers:
  - counts derived from actual canonical placements while existing fixed-location options remain present;
  - the count changing after an item is moved into its correct destination;
  - stale saved completion IDs not hiding an incomplete collection;
  - focusing the first misfiled member when a later member is loose;
  - omitting a collection after every member is correctly filed.
- Confirm the native selector remains keyboard accessible and existing destination, scratch-pad, and Engine jumps still work.
- Run the focused navigation E2E and production build. Do not run the full suite without approval.

## Verification results

- `npm run test:e2e -- --workers=1 e2e/lab/unfinished-collection-navigation.spec.js` passed 3/3. Coverage includes live canonical-placement counts, count updates after a move, stale completion flags, first misfiled-member focus, completed-collection removal, and preserved fixed jump targets.
- `npm run build` passed with Vite 8.3.5.
- Code review found no actionable issues. The full suite was not run.

## Boundary

This improves navigation in the current world. Keep adding collections and authored content gated on the independent two-chapter human playthrough recorded in `docs/plans/browser-scaling-playtest-gate.md`.
