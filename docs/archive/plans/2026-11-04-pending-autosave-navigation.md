# Plan: Protect Pending Autosaves During Navigation

**Status:** Complete (2026-11-04). The pending-save navigation warning is implemented and verified. The independent two-chapter human playtest and content-expansion gate remain open.

## Goal and boundary

Protect a player's latest game change when they try to leave or reload during the debounce/worker-save window. The autosave coordinator currently delays worker encoding, and the persistence hook does not warn before navigation while that work is pending. Reproduce the risk through a real filing before selecting the smallest implementation change.

Runtime changes, if the regression demonstrates they are needed, are limited to the persistence hook and autosave coordinator. Preserve the save format, worker timing, authored content, and unrelated game behavior. Do not close or alter the separate human playtest/content gate.

## Implementation approach

1. Add the focused browser regression described below before changing runtime behavior.
2. Reproduce a real item filing and attempt reload while the UI reports `Saving…`.
3. Implement only the persistence lifecycle handling needed to keep that pending save safe. Do not change serialization format or debounce timing.
4. Review navigation behavior for pending and completed saves, including cleanup of any event listener when the persistence hook is disposed.

## Test plan

**Focused regression added:** `e2e/lab/world-and-save-recovery.spec.js`, test `pending autosave warns before reload and preserves a newly filed item`. It:

- Starts from a fresh save and waits for its initial save to settle.
- Files a real item and confirms the save status is `Saving…`.
- Attempts a reload while the save is pending and expects the browser's native `beforeunload` dialog.
- Dismisses the dialog, confirms the same page runtime remains alive with the filed placement still present until the save completes, then decodes the stored save and checks the placement.
- Reloads after the save completes, expects no navigation prompt, and confirms the filed item is restored from storage.

**Pre-implementation baseline:** The new regression failed as expected: a reload requested during `Saving…` produced no `beforeunload` dialog. This reproduced the navigation data-loss window before runtime changes.

**Implementation:** `useGamePersistence` registers a `beforeunload` confirmation listener only while the save status is `Saving…`. The effect removes the listener when saving settles and on hook teardown. This warns about pending persistence; it does not synchronously flush a save during unload.

**Verification:** `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "pending autosave warns before reload"` passed 1/1, and the complete `world-and-save-recovery.spec.js` passed 28/28. After the prompt is dismissed, Playwright's canceled `page.reload()` rejects with `TimeoutError`; the test captures and asserts that expected cancellation and verifies the original page runtime remains active. It then confirms the save completes, the filed placement is in storage, and a subsequent reload needs no prompt. The initial sandbox worker spawn returned `EPERM`; the process-access retry passed. `npm run build` passed with Vite 8.3.5 (59 modules). Scoped Code Reviewer found no actionable findings. The full suite was not run.

## Acceptance criteria

- [x] The regression performs an actual filing and observes `Saving…` before requesting reload.
- [x] Reload during a pending save raises the native navigation dialog; dismissing it leaves the game open until persistence completes.
- [x] A subsequent reload after completion raises no dialog and restores the filed item.
- [x] The runtime change is limited to the persistence hook, keeps the existing save format and worker timing, and cleans up the navigation listener.
- [x] Focused checks pass, the scoped implementation is reviewed, and relevant project documentation is updated.
- [x] This plan is archived with a dated descriptive filename, leaving the separate browser-scaling playtest plan active in `docs/plans/`.

## Handoff and release notes

Architect finding: `src/game/persistence/autosaveCoordinator.js` debounces worker encoding by 450 ms and commits storage after the latest worker response; `src/app/useGamePersistence.js` had no `beforeunload` guard. Existing reload tests commonly wait for `Saved just now`; the new regression specifically covers navigation while the pending status is visible.

The human playtest deferral is independent of this persistence fix. Keep `browser-scaling-playtest-gate.md` active and keep content expansion gated until the user completes that playtest. The user chose to defer the independent human playthrough for now; the gate remains open.
