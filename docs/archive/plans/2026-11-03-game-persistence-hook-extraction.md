# Game persistence hook extraction

## Goal

Extract initial save loading, game/autosave state and coordinator, snapshot,
import, and start-fresh actions from `src/app/App.jsx` into
`src/app/useGamePersistence.js`, preserving current ordering and user-visible
behavior.

## Ownership and preservation contract

- The hook owns initial save load/recovery, normalized game state, the autosave
  worker and coordinator, current snapshot handling, import, and start-fresh
  actions. It also owns the worker/coordinator cleanup lifecycle.
- Keep selection, skill/puzzle, preferences/audio, and panel state in `App`.
- Preserve import's ordered flow: validate the incoming payload first; create a
  backup of the current save before applying it; notify `App` so completion
  audio suppression is set before the state update; then apply the imported
  state. Invalid imports leave current state and backups unchanged.
- Invalidate the autosave coordinator synchronously on every state update so
  stale pending writes cannot win a race. Preserve recovery and corrupt-save
  handling, autosave enable semantics, and worker teardown.
- Keep the existing snapshot and fresh-start outcomes, save schema, and
  persisted fields unchanged.

## Focused verification

- No new test is needed: existing coordinator unit coverage checks scheduling,
  invalidation/import, worker races, storage failures, and disposal. Recovery
  E2E covers corrupt/start-fresh flows, imports, migrations, backup, and
  reload; manual-save E2E covers pre-restore backup; the ending E2E verifies
  completion-audio suppression when importing a complete save.
- Run `node --test --test-isolation=none tests/unit/game-foundation/autosave-coordinator.test.mjs`.
- Run `npx playwright test e2e/lab/world-and-save-recovery.spec.js e2e/lab/manual-saves.spec.js --workers=1`.
- Run `npx playwright test e2e/lab/full-restoration-ending.spec.js --workers=1 --grep "importing a restored save shows the ending without activation"`.
- Run `npm run build` and code review after implementation.
- Do not run the full test suite for this slice.

## Outcome (2026-11-03)

- `node --test --test-isolation=none
  tests/unit/game-foundation/autosave-coordinator.test.mjs` passed 11/11.
- `npx playwright test e2e/lab/world-and-save-recovery.spec.js
  e2e/lab/manual-saves.spec.js --workers=1` passed 28/28.
- `npx playwright test e2e/lab/full-restoration-ending.spec.js --workers=1
  --grep "importing a restored save shows the ending without activation"`
  passed 1/1.
- `npm run build` passed with Vite 8.3.5. Code Reviewer found no findings;
  final callback-return compatibility review passed. `git diff --check` was
  clean. The full suite was not run.
