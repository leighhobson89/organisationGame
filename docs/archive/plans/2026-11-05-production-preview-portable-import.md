# Plan: Production Preview Portable Import

**Status:** Finalized; focused production-preview import regression and review passed.

## Goal and rationale

Extend the isolated production-preview smoke to verify a portable export/import round trip against the built app served by Vite Preview. Preserve the existing module/worker MIME, runtime, missing-asset, and filed-card autosave/reload checks while confirming an import restores an earlier exported state and keeps the pre-import state as backup.

## Scope and constraints

- Extend `production-tests/production-smoke.spec.js`, which remains outside default E2E discovery.
- Capture a valid initial export from Save & Restore before changing the game state.
- File `calibration-card-01` into `cabinet-calibration` and wait for autosave; verify the card is filed before importing.
- Import the captured initial export with the required acknowledgement, and verify success feedback.
- After import autosaves and the app reloads, verify the current exported/autosaved state has the initial placement reset, while the pre-import backup preserves the filed card state.
- Keep the existing production module/worker MIME, runtime-error, missing-asset, and successful filed-state reload assertions intact.
- Keep this test-only unless the production-preview journey demonstrates a production-specific defect; any fix must stay within that defect's scope.
- Run only the focused production smoke; do not run the full E2E or unit suite. Keep the independent human-playtest/content-expansion gate unchanged.

## Implementation approach

1. Extend the isolated production smoke to capture a valid initial portable export through Save & Restore.
2. File the calibration card, wait for autosave, and confirm the filed state before importing.
3. Import the initial export, acknowledge the replacement, assert success feedback, and wait for the imported state to autosave.
4. Reload and check that current state/export reflects the initial unfiled placement while the pre-import backup retains the filed placement.
5. Run the focused production command. Make a production code change only if the browser smoke demonstrates a production-specific defect; then rerun the focused smoke and obtain scoped review.

## Test plan

Standard focused command: `npm run test:e2e:production -- --grep "portable import"`.

The standard command could not start because port 5183 was reported occupied despite a free-listener check. The Test Engineer used a temporary port-5184 config and ran `npx playwright test --config=playwright.production.smoke.temp.config.js --grep "portable import"`; it passed **1/1 in 7.7 seconds**. Coverage verifies the initial export, filing/autosave of the calibration card, successful import and feedback, zero filed count in live/export/autosave after reload, and the filed pre-import state retained in backup. The temporary config was removed. No app source change or full suite was run. Final review found no actionable findings.

## Acceptance criteria

- [x] The production smoke captures a valid initial export before the card is filed.
- [x] Filing `calibration-card-01` autosaves correctly before the import and creates a pre-import backup that preserves the filed state.
- [x] Importing the initial export reports success; after autosave/reload, current exported/autosaved state reflects the initial reset placement while backup still reflects the filed state.
- [x] Existing module/worker MIME, runtime, missing-asset, and reload coverage remains intact; default E2E discovery remains unchanged.
- [x] The equivalent isolated focused production command passes after the standard port-5183 command was blocked; any production fix is scoped to a demonstrated production-only defect; the full suite is not run and the human-playtest/content-expansion gate stays unchanged.
