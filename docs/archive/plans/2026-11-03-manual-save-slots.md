# Plan: Manual Save Slots

**Status:** Complete. Three manual save slots are implemented, focused-verified, built, and reviewed. The separate `docs/plans/browser-scaling-playtest-gate.md` remains active; the human playthrough is incomplete and content expansion remains gated.

## Current gap

The Save & Restore dialog can export and validated-import a compressed save. **Create local backup** currently stores one compressed snapshot under `MANUAL_SAVE_KEY`, but the app has no UI to list, restore, or delete that snapshot. There are no named manual save slots.

## Goal and storage contract

Add three fixed browser-local save slots labeled **Slot 1**, **Slot 2**, and **Slot 3**. Show whether each slot is empty or contains a save and display its saved time when available. Each slot is independent so one malformed entry does not make the other slots unavailable.

- Keep `MANUAL_SAVE_KEY` as Slot 1 for compatibility. Use separate localStorage keys for Slots 2 and 3.
- Store new slot saves in a small versioned metadata envelope around the existing compressed game-save payload. The envelope should contain its storage version, slot ID, ISO save timestamp, and compressed payload. Do not modify the v3 game-save schema or store preferences in it.
- Treat an existing bare compressed value under `MANUAL_SAVE_KEY` as a legacy Slot 1 snapshot with an unknown date. Read it without rewriting it. Replace it only after the player confirms an overwrite.
- Saving into an empty slot stores the current game snapshot immediately. Overwriting a populated slot requires confirmation. Deleting a populated slot also requires confirmation.
- Restoring a populated slot requires confirmation that current progress will be replaced. Validate and migrate the compressed payload through the existing `importSave` path. Before applying it, back up the current game using the existing `BACKUP_SAVE_KEY` behavior. Reuse the existing successful-import flow to apply the state and resume autosaving.

### Persistence helper contract

The Test Engineer's unit contract uses these helpers and result shapes:

- `readManualSaveSlots(storage)` returns `{ slots: [...] }` with three records shaped as `{ slotId, status, encodedSave?, savedAt?, legacy? }`; status is `empty`, `saved`, `corrupt`, or `unavailable`.
- `saveManualSaveSlot(storage, slotId, encodedSave, { overwriteConfirmed, now })` returns an explicit status such as `saved`, `confirmation-required`, `invalid-save`, or `unavailable`. The injected `now` value supports deterministic timestamp tests.
- `deleteManualSaveSlot(storage, slotId, { confirmed })` returns an explicit result status, including the confirmation-required case.

The slot helpers must validate the compressed save before accepting it. Legacy Slot 1 records are marked `legacy: true` and have an unknown timestamp until replaced with a confirmed new save.

## Failure and safety behavior

- If a slot envelope or payload is malformed or unsupported, show that slot as unavailable/corrupt and provide clear feedback. Do not attempt restore and do not automatically delete, repair, or overwrite its stored value.
- A corrupt slot must not prevent access to the other two slots.
- If browser storage is unavailable or a write/delete fails, report the failure in the dialog without crashing or changing live game state. Do not claim a save, overwrite, deletion, or restore succeeded when persistence failed.
- A canceled overwrite, delete, or restore leaves all slot data and live game state unchanged.
- A rejected restore leaves live state, autosave, pre-restore backup, and slot data unchanged. If the current-game backup cannot be written, do not apply the slot save.
- Keep the existing restore-before-mutation rule: parse and validate the slot payload before applying any game state changes.

## Scope boundaries

- Do not change the v3 game-save schema or the compressed payload format.
- Slot listing, save, overwrite, and delete must not change autosave, preferences, recovery storage, portable export/import behavior, or game progression.
- A confirmed slot restore uses the existing validated import and pre-restore backup path; keep its autosave behavior consistent with a successful import.
- Do not alter existing preferences, content, IDs, ordering, positions, or progression.
- Keep the independent two-chapter human playthrough and content-expansion gate active.

## Acceptance criteria

- The Save & Restore dialog shows exactly three fixed slots with saved/empty status and timestamps for new envelope saves.
- A legacy compressed string in `MANUAL_SAVE_KEY` appears as Slot 1 with unknown timestamp and remains unchanged until a confirmed overwrite.
- Empty-slot saves work; occupied-slot overwrite and slot deletion require confirmation.
- Slot restore requires confirmation, passes the existing validated import path, creates the pre-restore backup before mutation, and updates the game through the normal successful-import flow.
- Canceling a confirmation, rejecting malformed/unsupported data, or failing to create the backup leaves live state, autosave, backup, and slot values unchanged.
- Storage failures and one corrupt slot are communicated accessibly and do not prevent game use or access to other slots.
- Slot operations do not add fields to v3 saves or change existing autosave, preference, recovery, portable export, or external import semantics.

## Focused validation plan

The Test Engineer added the focused regressions. Their targets, commands, and pre-implementation outcomes are recorded below.

Planned unit coverage:

- Three empty slots; save and round-trip of compressed payload and envelope metadata.
- Overwrite requires explicit confirmation and affects only the selected slot; delete requires confirmation and affects only one slot.
- Legacy bare `MANUAL_SAVE_KEY` recognition without rewriting; malformed slot isolation from valid neighbors.
- Per-slot storage read/write failures return `unavailable` without mutating other slots.
- Confirm storage operations preserve autosave, preferences, recovery data, and game-save payloads.

Planned browser coverage:

- Save into an empty slot without confirmation; confirm overwrite and deletion, checking focus returns after confirmation and canceled actions preserve the slot.
- Save a snapshot, import altered progress, reload, cancel a restore, then confirm restore; verify the restored UI/autosave, pre-restore backup, persistent slot, and unchanged preferences.
- Verify a damaged slot does not hide a valid neighbor.

- Unit test target: `tests/unit/game-foundation/manual-saves.test.mjs`.
- Focused unit command: `node --test --test-isolation=none tests/unit/game-foundation/manual-saves.test.mjs`.
- E2E test target: `e2e/lab/manual-saves.spec.js`.
- Focused E2E command: `npx playwright test e2e/lab/manual-saves.spec.js --workers=1`.
Pre-implementation unit result: `node --test --test-isolation=none tests/unit/game-foundation/manual-saves.test.mjs` failed before tests ran with `ERR_MODULE_NOT_FOUND` for `src/game/persistence/manualSaves.js`.

Pre-implementation E2E result: `npx playwright test e2e/lab/manual-saves.spec.js --workers=1` did not reach test collection or execution because Playwright worker startup failed with Windows `spawn EPERM` in `WorkerHost.startRunner` / `child_process.spawn`. This was a runner startup blocker, not a behavioral test result; the final focused E2E run succeeded with process-spawn access. `node --check` passed on both regression files.

Final focused results: `node --test --test-isolation=none tests/unit/game-foundation/manual-saves.test.mjs` passed 9/9; `npx playwright test e2e/lab/manual-saves.spec.js --workers=1` passed 2/2, including confirmation focus return, reload/restore, and the pre-restore backup; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The E2E run used process-spawn access after the initial Windows `spawn EPERM` runner-startup blocker. The full test suite was not run.

Run focused tests and the production build only for this milestone. Do not run the full suite without user approval as required by `AGENTS.md`.

## Handoff and completion

The Architect defined the slot and compatibility contract; the Test Engineer added focused regressions and captured pre-implementation results. Implementation reused the existing save validation, import backup, and autosave flows. Code review confirmed legacy Slot 1 preservation, failure atomicity, confirmation behavior, and separation from the game-save schema. Final results are recorded above.

- [x] Record the current save gap, slot contract, boundaries, failure behavior, and acceptance criteria.
- [x] Record the unit import-failure baseline, E2E worker-startup result, and syntax checks before implementation.
- [x] Implement three manual save slots and confirmation flows without changing the game-save schema.
- [x] Pass focused unit/E2E checks and build.
- [x] Complete code review with no actionable issues.
- [x] Keep `docs/plans/browser-scaling-playtest-gate.md` active and content expansion gated.

This plan is archived after implementation, focused verification, and review. The human playthrough remains a separate active gate.
