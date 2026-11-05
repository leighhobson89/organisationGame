# Plan: Restore Focus After Notebook Collection Navigation

## Problem

Activating a collection row in `NotebookPanel` closes the Notebook and focuses its destination. The row button is unmounted, and the current `focusCollection` path does not return focus or announce the camera target. Keyboard users can lose their place without confirmation of where the view moved.

## Scope and implementation

- Support keyboard activation of a Notebook collection row at desktop and at 390 × 480.
- After navigation closes Notebook and centers the collection's destination, return focus to the persistent `toggle-notebook` control.
- Announce the resolved destination through the existing polite `world-announcer`.
- Keep the existing camera navigation and persistence path; do not alter collection state, progression, save schema, or save contents beyond the existing camera update.

## Acceptance criteria

- At desktop and at 390 × 480, pressing Enter on a collection row closes Notebook and centers its destination.
- After the Notebook closes, `toggle-notebook` receives focus and its pressed state reflects that Notebook is closed.
- The live announcement names the destination that received focus.
- Pressing Enter again on the focused `toggle-notebook` reopens Notebook.
- Collection placement, rewards, progression, and unrelated save data remain unchanged.
- Existing pointer activation and other world navigation behavior remain intact.

## Focused verification

- The two viewport cases are in `e2e/lab/notebook-collection-navigation.spec.js`. Command: `npx playwright test e2e/lab/notebook-collection-navigation.spec.js --workers=1 --reporter=line`.
- Red baseline: both cases failed 2/2 only because `toggle-notebook` did not receive focus and `world-announcer` remained empty. Centering, camera autosave, unchanged items/progress/notebook data, Notebook closure, and Enter-to-reopen passed. The initial sandbox worker spawn returned `EPERM`; the process-access rerun confirmed the failures after correcting the test to allow expected camera autosave and assert other saved fields are unchanged.
- Final E2E passed 2/2 at desktop and 390 × 480, covering Notebook closure, destination centering and announcement, focus return, reopening, camera autosave, and unchanged non-camera save data.
- Vite 8.3.5 build passed with 62 modules. Scoped review found no actionable findings. The full suite was not run.
- `docs/ARCHITECTURE.md`, `docs/TESTING_GUIDE.md`, and `docs/ROADMAP.md` record the behavior and verification results.

## Status

Complete. Focused E2E, production build, documentation update, and scoped review are complete. Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-notebook-collection-focus-return.md`.
