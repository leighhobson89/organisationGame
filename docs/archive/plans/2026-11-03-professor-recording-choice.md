# Professor Recording Choice in the Ending

## Goal

Make the clue-supported reconstruction explicit in the full-restoration ending: the Professor chose to keep the Palimpsest Engine recording through an unstable echo so the account of what he and Elian witnessed would survive.

## Scope and constraints

- Keep the Engine as a recorder and witness, not the cause of the Chaos Event.
- Keep the Event's original trigger unknown and Elian's response unresolved.
- Do not change catalog data, progression rules, save data, or the ending trigger.
- Keep the existing browser-scaling and human-playthrough gate active.

## Implementation and documentation

- Update `src/ui/CompletionSequence.jsx` to state the chosen reading plainly, without the current “strongest reading” hedge.
- Tighten `e2e/lab/full-restoration-ending.spec.js` to require the clear choice and preserve checks for the unsent apology, both witnesses, and the two unanswered questions.
- Align `docs/GAME_VISION.md`, `docs/ARCHITECTURE.md`, and other directly relevant summary documentation with the explicit reconstruction.
- The focused E2E assertion in `e2e/lab/full-restoration-ending.spec.js` requires the narrative to say that the Professor chose to keep the Engine recording through an unstable echo so their account would survive, and rejects the `strongest reading` hedge. Existing checks continue to cover the unsent apology, the Engine and both people as witnesses, the unknown Event trigger, and Elian's unresolved response.

## Test plan and red baseline

- Focused case: `the final correct filing triggers the Engine ending once and keeps the restored lab explorable`.
- Red baseline (2026-11-03): the case failed at the new narrative assertion because the ending still contained the old `strongest reading` copy.
- Final focused command: `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js`.
- Then run `npm run build` and request code review. Do not run the full suite without user approval.

## Verification

- [x] Run `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js` — 5/5 passed.
- [x] Run `npm run build` — passed with Vite 8.3.5.
- [x] Complete code review — no actionable issues.
- [x] Do not run the full suite without user approval; the full suite was not run.

## Completion

Completed 2026-11-03. Relevant documentation is updated. The independent human playthrough remains open in `docs/plans/browser-scaling-playtest-gate.md`.
