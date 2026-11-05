# Plan: Startup with Unavailable Local Storage

**Status:** Finalized; focused E2E regression passed and final review found no actionable findings.

## Goal and rationale

Verify the app starts safely when browser localStorage is inaccessible before application startup. The player should still get a fresh 174-item world, clear storage-recovery and autosave-unavailable notices, and usable world interaction without an uncaught page error.

## Scope and constraints

- Add one focused E2E case in `e2e/lab/world-and-save-recovery.spec.js`.
- Use `page.addInitScript` to redefine the `window.localStorage` getter so it throws before the app initializes.
- Assert a fresh 174-item world, a visible storage-unavailable recovery notice, and `Autosave unavailable` status.
- Exercise a basic world interaction (for example, select a visible item and open its Inspector) to confirm the app remains usable.
- Assert no uncaught page error occurs during startup and interaction.
- Do not inspect localStorage from the page in this test; the getter intentionally throws.
- Keep this test-only unless the E2E demonstrates a startup or user-visible recovery defect. Preserve the independent human-playtest/content-expansion gate.

## Implementation approach

1. Register the throwing localStorage getter through `page.addInitScript` before navigating to the app.
2. Verify fresh-world item count, storage-unavailable recovery notice, and autosave-unavailable status.
3. Perform a basic item interaction and check the page error collection remains empty.
4. Run only the focused storage-unavailable E2E. If the app fails to recover or the UI is unclear, make the smallest scoped fix and rerun the same case; otherwise keep the change test-only.

## Test plan

Focused command: `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "browser storage is unavailable"`.

The focused command `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "browser storage is unavailable"` passed **1/1 in 2.8 seconds** after a process-access retry. The test installs the throwing localStorage getter before startup, checks 174 items, the alert recovery notice, `Autosave unavailable`, selects the calibration card to open its Inspector, confirms no page error, and performs no page-side storage read. No app or full-suite change was made. Final review found no actionable findings.

## Acceptance criteria

- [x] The test makes the localStorage getter throw before app startup, without reading storage later from the page.
- [x] Startup renders the fresh 174-item world and reports storage recovery and `Autosave unavailable`.
- [x] A basic world interaction succeeds and no uncaught page error is recorded.
- [x] Only the focused E2E is run; no app change was needed; the plan is archived and the separate human-playtest/content-expansion gate remains active.
