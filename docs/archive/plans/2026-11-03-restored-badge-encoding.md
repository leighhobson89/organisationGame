# Restore the Collection Badge Encoding

**Status:** Complete and reviewed on 2026-11-03. This polish fix does not change game content or close the active human-playtest gate.

## Goal

Show the completed collection badge as intentional readable text, `✓ Restored`, instead of corrupted characters. Correct the mojibake viewport separator in the three affected responsive-test notes.

## Scope and constraints

- Update the completed-state badge in `src/ui/DestinationCard.jsx`; retain its existing accessible name and completion-state behavior.
- Add a focused browser regression in `e2e/lab/organising-loop.spec.js` asserting that a completed collection visibly shows `✓ Restored` (and remains available by its accessible name if useful to the test).
- Use the Unicode multiplication sign U+00D7 (`×`) in the `390 × 480` viewport note in `docs/ARCHITECTURE.md`, `docs/VERTICAL_SLICE.md`, and `docs/TESTING_GUIDE.md`.
- Do not alter catalog data, progression, saved state, other UI glyphs, or the active `browser-scaling-playtest-gate.md` plan.
- Keep `docs/plans/` limited to the active playtest gate plus this plan; archive this plan after implementation, review, focused verification, and relevant documentation are complete.

## Acceptance criteria

- A completed collection renders the exact visible label `✓ Restored` in a supported browser and the badge keeps its accessible label.
- The focused organizing-loop E2E regression passes with the visible label assertion.
- The production build passes and Code Reviewer finds no actionable issues.
- The three affected docs use the correctly encoded `390 × 480` dimensions.
- The active human-playtest/content-expansion gate remains open and unchanged.

## Focused verification

Test file: `e2e/lab/organising-loop.spec.js`.

The Test Engineer added the visible-label assertion to the existing organizing-loop spec. Its pre-implementation red baseline was **1 failed**: the test expected U+2713 (`✓`) followed by `Restored`, but the app rendered a mojibake checkmark sequence followed by `Restored`.

Focused red-baseline command: `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js --grep "recover a misfiled card"`.

Focused final command: `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js --grep "recover a misfiled card"` — **1/1 passed** after implementation; the red baseline above was **1/1 failed** on the visible-label assertion.

`npm run build` passed with Vite 8.3.5. Code Reviewer found no actionable findings. The full test suite was not run. The testing guide records these results; the viewport separator was corrected in the Architecture and Vertical Slice notes as well. The independent human playthrough remains open and content expansion remains gated.

Archived at `docs/archive/plans/2026-11-03-restored-badge-encoding.md` after implementation, focused verification, review, and documentation. `docs/plans/` retains only the active `browser-scaling-playtest-gate.md`.
