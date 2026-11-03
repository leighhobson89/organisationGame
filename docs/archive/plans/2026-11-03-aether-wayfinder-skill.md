# Plan: Aether Wayfinder Skill

**Status:** Complete (2026-11-03). Final focused verification and review passed;
the full test suite was not run. The independent human-playtest and
content-expansion gate remains open. Archived as
`docs/archive/plans/2026-11-03-aether-wayfinder-skill.md`.

## Goal

Add the optional two-point **Aether Wayfinder** Workshop Skill. When the player
activates it for a selected item that is not correctly filed, focus the camera
on that item's canonical destination and guide attention to the destination
for seven seconds. This includes items in the temporary scratch pad. The
player remains responsible for moving and filing the item.

## Boundaries and intended behavior

- Register the skill as `aether-wayfinder` in `SKILLS`, with a cost of two
  insight points and explicit action, active, and unavailable labels for
  `SkillsPanel`.
- Enable activation only when the player owns the skill and has selected an
  eligible item. Disable it when nothing is selected or the selected item is
  already correctly filed. Every item that is not correctly filed is eligible,
  including loose workspace items, misfiled destination items, and temporary
  scratch-pad items.
- Resolve the selected item's `correctDestinationId` to its canonical
  destination. On activation, use the existing `WorldViewport`
  `focusDestination` handle, passing a minimum readable preferred scale of
  `0.72` through `fitTargetScale`, and show that destination's guided state for
  seven seconds.
- Mark the destination visually with a color/shape cue and the visible text
  **For this item**. Include the item title and destination in the destination
  card's accessible name. Issue one Wayfinder-specific polite live status with
  both the selected item title and destination; the existing zoom readout may
  independently announce camera zoom.
- Clear the guided destination when the seven-second timer expires, selection
  changes, or the selected item becomes correctly filed. Clean up or replace
  any pending timer when the skill is activated again so stale timers cannot
  clear a newer guide.
- Respect both the saved reduced-motion preference and the OS preference by
  suppressing the highlight animation. Keep the static visual cue, text marker,
  and announcement available.
- Never move, file, validate, or otherwise mutate the item when the skill is
  used. The activation changes only camera focus and transient presentation;
  it does not change progression, item count, or saved state beyond persistent
  ownership of the skill.
- Add no item, destination, collection, story beat, or automation. Keep the
  separate human-playthrough/content-expansion gate open.

## Implementation constraints

1. Add the skill metadata to `src/game/content/catalog.js`. Store its purchased
   ownership in the existing `progress.ownedSkills` list; add no save fields
   and do not change schema version 3.
2. Extend the App skill action path to determine eligibility from the selected
   item, focus its canonical destination through `worldRef` at a minimum
   readable preferred scale of `0.72` passed through `fitTargetScale`, emit the
   existing `skill.activated` event, update one Wayfinder-specific polite live
   status containing the item title and destination, and own the seven-second
   transient timer. Keep guided state out of `game` and autosave. The separate
   zoom readout may continue to announce zoom changes.
3. Pass transient guided destination/item context through `WorldViewport` to
   `DestinationCard`. Add the visual and accessible **For this item** marker,
   and include the item title and destination in the card's accessible name;
   leave placement, completion, and destination-count behavior unchanged.
4. Generalize or supply `SkillsPanel` action labels for Aether Wayfinder so
   the action, temporary active state, and unavailable hint are clear. Preserve
   existing Resonance Lens, Missing Member Compass, and passive Modular
   Worktables behavior.
5. Keep reduced-motion behavior consistent with the existing saved preference
   and `prefers-reduced-motion` handling. The animation may be suppressed; the
   guided destination must remain visibly and accessibly identified.

## Save compatibility

The new ID is admitted to current v3 saves through the skill IDs derived from
`SKILLS` and is persisted in the existing `progress.ownedSkills` field. Do not
add `aether-wayfinder` to the v1/v2 `legacySkillIds` whitelist. Legacy migration
must continue to accept only its existing legacy skill IDs; attempting to
claim this new skill in a v1 or v2 save remains invalid. The active timer,
guided destination/item, and visual marker are transient and must not enter
v3 save data, imports, or autosaves.

## Risks and verification

- Correctly-filed detection must require the item's `validation` to be
  `correct`, destination placement, and a match to its `correctDestinationId`;
  a merely filed but misfiled item stays eligible.
- Clear the transient guide if the selected item changes or is filed correctly
  during the seven-second window. Ensure an earlier timeout cannot clear a
  later activation.
- Keep the destination marker's text and shape cue available without color or
  animation, and ensure the live announcement is not repeatedly emitted by
  render updates.
- Verify scratch-pad items are eligible whenever they are not correctly filed.
  Check guide legibility when the destination is focused from low zoom: the
  preferred scale must be at least `0.72` and flow through `fitTargetScale`.
- Check the guided destination's accessible name contains both the selected
  item title and destination. The Wayfinder-specific polite status must include
  both; any camera-zoom announcement belongs to the separate zoom readout.
- Verify activation leaves the complete item and progress state unchanged,
  while camera focus and destination feedback occur. Verify reduced-motion
  settings suppress animation without hiding the guide.
- Verify v3 ownership survives reload, while v1/v2 legacy whitelist behavior
  remains unchanged. Confirm no timer or guided presentation is serialized.
- **Focused E2E regression:**

  ```sh
  npm run test:e2e -- --workers=1 e2e/lab/aether-wayfinder.spec.js
  ```

  All 12 cases pass. Coverage includes skill ownership and availability;
  workspace, scratch-pad, and misfiled-item eligibility; canonical destination
  focus through `fitTargetScale` at the minimum preferred scale of 0.72;
  selection-change and correct-filing cleanup; seven-second expiry; no
  item/progression mutation; an accessible destination name and Wayfinder live
  status containing the item title and destination; and OS/user reduced-motion
  behavior. The camera zoom readout may announce zoom independently.
- **Focused save compatibility regression:**

  ```sh
  node --test --test-isolation=none --test-name-pattern="Aether Wayfinder" tests/unit/game-foundation/game-systems.test.mjs
  ```

  Both checks pass. They cover the unchanged legacy whitelist and admission of
  the skill ID in current v3 saves. Legacy v1/v2 behavior remains unchanged.
- **Panel coordination:**

  ```sh
  npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js
  ```

  The shared panel-coordination regression passed 8/8.
- **Recorded red baseline before implementation:** all nine then-existing E2E
  cases failed because the Aether Wayfinder skill card was absent. The focused
  unit command reported one pass for the unchanged legacy whitelist and one
  expected failure because the v3 skill was absent.
- **Final verification:** Wayfinder E2E passed 12/12, panel-coordination E2E
  passed 8/8, the named unit check passed 2/2, and `npm run build` passed with
  Vite 8.3.5. Final Code Reviewer review found no actionable findings. The full
  test suite was not run. Keep the independent human-playtest/content-expansion
  gate open.
