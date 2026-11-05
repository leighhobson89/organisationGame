# Plan: Restore Focus After Compact Collection Completion

## Problem

At compact widths, completing a non-final research collection from the single-item Inspector opens the Notebook and unmounts the focused Move button. Focus can fall back to the document instead of a persistent game control.

## Scope and implementation

- Cover a keyboard-driven single-item Inspector move that completes the `bell-before-dawn` collection at 390 × 480.
- When compact collection completion opens Notebook and closes Inspector, return focus to the persistent `multi-selection-toggle` control, matching the existing group-move fallback.
- Preserve desktop panel behavior and pointer world-drop behavior.
- Preserve placement, collection reward, progression, and autosave behavior.

## Acceptance criteria

- Starting from a save with 7/8 `bell-before-dawn` members correctly filed, moving the final member through the Inspector by keyboard completes the collection.
- At 390 × 480, Notebook is visible, Inspector is closed, and `multi-selection-toggle` receives focus.
- The completed placement and collection progress are autosaved.
- Desktop completion behavior remains unchanged.
- Pointer-based world drop behavior remains unchanged.
- No unrelated placement, progression, or persistence behavior changes.

## Focused verification

- The compact keyboard regression is `compact keyboard completion returns focus after opening the notebook` in `e2e/lab/research-chapter.spec.js`. Run `npx playwright test e2e/lab/research-chapter.spec.js --grep "compact keyboard completion returns focus" --workers=1 --reporter=line`.
- Red baseline: the test failed 1/1 at the `multi-selection-toggle` focus assertion after compact layout, Notebook visibility, Inspector closure, 8/8 collection completion, autosave, and progress assertions passed. The initial sandbox worker spawn returned `EPERM`; the process-access rerun confirmed the expected focus failure.
- A desktop preservation regression, `desktop keyboard collection completion keeps the Inspector focused`, was added in `e2e/lab/research-chapter.spec.js`.
- Final focused run: `npx playwright test e2e/lab/research-chapter.spec.js --grep "compact keyboard completion|desktop keyboard collection completion" --workers=1 --reporter=line` passed 2/2, verifying compact focus restoration and unchanged desktop focus behavior.
- Preserve existing pointer world-drop coverage. Vite 8.3.5 build passed with 62 modules. Scoped review found no actionable findings. The full suite was not run; process-access was used because the sandbox worker spawn returned `EPERM` on the red baseline.
- `docs/ARCHITECTURE.md`, `docs/TESTING_GUIDE.md`, and `docs/ROADMAP.md` record the compact-only behavior and results.

## Status

Complete. Focused E2E, build, documentation update, and scoped review are complete. Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-compact-collection-completion-focus.md`.
