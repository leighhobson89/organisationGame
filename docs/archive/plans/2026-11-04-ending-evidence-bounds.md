# Bound the Restoration Ending to Recovered Evidence

## Goal

Revise the full-restoration ending so it states what the authored clues support about the Professor's choice without inventing the choice's details or its relationship to the Chaos Event.

## Evidence and scope

The authored **Unsent Apology** says the Professor fears Elian will blame the machine for a choice he made. Other recovered records identify the Professor and Elian as witnesses and show that the Engine replayed an impression left by the Event. The clues do not establish that the Professor kept the Engine recording through an unstable echo, what specific choice he made, or whether that choice caused or otherwise related to the Event.

Keep the Engine as a recorder and witness, not the cause of the Event. Keep the Event's original trigger and Elian's response unresolved. Do not change catalog data, progression rules, save data, or the ending trigger.

## Implementation approach

- Revise `src/ui/CompletionSequence.jsx` to say that the apology points to an unspecified choice involving the machine, while making clear the recovered record does not reveal what he chose or how it relates to the Event.
- Update `e2e/lab/full-restoration-ending.spec.js` to assert the supported inference and reject the unsupported "keep recording through an unstable echo" claim. Preserve checks for the Engine and both people as witnesses, the apology, the unknown trigger, and Elian's unresolved response.
- Align `docs/GAME_VISION.md`, `docs/VERTICAL_SLICE.md`, and relevant roadmap wording with the evidence-bounded account.

## Test plan and red baseline

- Focus the regression on `the final correct filing triggers the Engine ending once and keeps the restored lab explorable` in `e2e/lab/full-restoration-ending.spec.js`.
- Red baseline command: `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js --grep "final correct filing triggers"`.
- Red baseline result: the new apology assertion failed because the existing ending copy asserts the unsupported recording-through-an-unstable-echo story. The initial sandbox worker spawn returned `EPERM`; the elevated rerun produced this red result.
- The revised assertions must require only the supported inference that the apology points to an unspecified choice involving the machine, and must reject the unsupported recording-through-an-unstable-echo claim. Preserve checks that the Engine was a witness rather than the cause, Professor and Elian were witnesses, the trigger is unknown, and Elian's response is unresolved.

## Implementation, verification, and review

- Update the ending copy and focused narrative assertions, then align the directly relevant vision, vertical-slice, and roadmap summaries.
- Final focused command: `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js`.
- Final focused result: passed 13/13 after the initial sandbox worker spawn returned `EPERM` and the rerun used process access.
- Scoped Code Reviewer found no actionable findings. No production build or full test suite was run.
- Run `git diff --check` on changed files.
- Do not run the full test suite without user approval. No production build is required unless implementation changes warrant one.

## Documentation and completion

Completed 2026-11-04. The ending and focused assertions now stay within the authored evidence; the historical specific recording-choice claim is explicitly superseded in summary documentation. The original Event trigger and Elian's response remain unresolved, and the records do not name the Professor's choice or its relation to the Event. Archive this finalized plan as `docs/archive/plans/2026-11-04-ending-evidence-bounds.md`; keep `docs/plans/browser-scaling-playtest-gate.md` active.
