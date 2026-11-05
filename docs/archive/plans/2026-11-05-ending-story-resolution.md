# Plan: Resolve the Professor's Choice from Existing Clues

**Status:** Completed 2026-11-05.

## Goal

Give the full-restoration ending a clear, clue-based reading of the Professor's unnamed choice, as requested, without adding unsupported facts or expanding the catalog.

## Evidence and interpretation

- `src/game/content/catalog.js` says Trial 03 held the first stable impression on 12 October. The 13 October Survey Instructions say the Professor ordered a bearing check after that impression; the Meridian records say the corrected bearings led toward the sealed bell chamber.
- The chronology then places a sealed-chamber reading on 14 October and the unattended bell on 15 October. The East Gallery route and “Two Witnesses, One Impression” place the Professor and Elian at the 02:17 event.
- The Chronology reward says the Engine replayed an impression left by the event; it did not cause the bell to ring. The Unsent Apology fears Elian will blame the machine for a choice the Professor made.
- The strongest supported interpretation is that the Professor chose to pursue the first stable impression by ordering the eastward survey toward the chamber. The records connect that investigation to the place and period of the later event, but do not prove his choice caused the Chaos Event or reveal its original trigger.

## Scope

- Update `src/ui/CompletionSequence.jsx` to present that interpretation as the ending's best reading, distinguish the Engine's recording from the Event's cause, and retain uncertainty where the recovered records stop.
- Add focused assertions in `e2e/lab/full-restoration-ending.spec.js` for the eastward-survey interpretation and the causal boundary.
- Align `docs/GAME_VISION.md`, `docs/VERTICAL_SLICE.md`, `docs/ROADMAP.md`, and any directly affected README summary.
- Keep catalog text, progression, ending eligibility, save schema, and human-playtest/content-expansion gate unchanged.

## Acceptance

- The ending makes a coherent choice explicit as an interpretation: the Professor chose to follow the first stable impression toward the sealed bell chamber through the eastward survey.
- It connects that decision to the later event without claiming the survey or the Engine caused the Chaos Event.
- The Engine remains a witness/recorder; the original Event trigger and Elian's response remain unresolved.
- No new clue, catalog item, progression rule, or saved field is introduced.
- The focused ending regressions pass. This automated verification does not close the independent human playtest gate.

## Verification

- Focused regression: `e2e/lab/full-restoration-ending.spec.js`, case `the final correct filing triggers the Engine ending once and keeps the restored lab explorable`.
- The new assertions require the ending's strongest reading to connect the Professor's choice to following the first stable impression through the eastward survey toward the sealed bell chamber, state that the records do not directly name that choice, and avoid asserting that the choice caused or triggered the Chaos Event. Existing assertions retain the Engine-as-witness/not-cause, both human witnesses, the unknown original trigger, and Elian's unresolved response.
- Red baseline: `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js --grep "final correct filing triggers"` ran one case and failed exactly at the new interpretation assertion; the prior ending assertions passed.
- Final focused command: `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js` passed 15/15. A separate final compact 320 × 400 / 150% case passed.
- A longer expanded copy initially failed four compact 150% cases; the copy was tightened and the compact cases passed. No CSS changes were needed.
- Code Reviewer re-review found no findings. The change was copy-only, so no build was run; the full suite was not run.
- Scoped `git diff --check` on the updated documentation reported no whitespace errors.

## Documentation and completion

Current story summaries in README, Game Vision, Architecture, Vertical Slice, Roadmap, and Testing Guide now describe the strongest reading: the Professor chose to follow the first stable impression by ordering the eastward survey toward the sealed bell chamber. They retain that the evidence does not establish his decision caused the Event, that the Engine is a recorder/witness, and that the original trigger and Elian's response are unresolved. Historical 2026-11-04 evidence-bounds notes remain unchanged. The independent human playtest remains deferred and content expansion stays gated.

## Boundaries

The independent two-chapter human playthrough remains deferred by the user. Keep `docs/plans/browser-scaling-playtest-gate.md` active and leave content expansion gated. This slice resolves only the ending's best-supported interpretation from the clues already in the game.
