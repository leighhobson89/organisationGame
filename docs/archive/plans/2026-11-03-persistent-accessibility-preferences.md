# Plan: Persistent Accessibility Preferences

**Status:** Complete. Persistent accessibility preferences are implemented and focused-verified; Code Reviewer confirmed both findings resolved with no remaining issues. The separate `docs/plans/browser-scaling-playtest-gate.md` remains active and content expansion remains gated.

## Goal

Add persistent text-size and motion preferences for the current game session and future visits. Keep user preferences in a separate versioned localStorage entry, never in the game save. Make the Settings dialog operable and understandable with keyboard and assistive technology, and ensure user motion preferences can increase but never reduce the motion reduction requested by the operating system.

## Preference and storage contract

Implement `src/game/preferences/preferences.js` with these exports:

- `PREFERENCES_STORAGE_KEY`: dedicated versioned localStorage key, separate from autosave and backup keys.
- `DEFAULT_PREFERENCES`: `{ textScale: 1, reduceMotion: false }`.
- `normalizePreferences(value)`: accept unversioned runtime preference values and version 1 envelopes; return defaults for malformed data, invalid values, or an explicitly supplied unknown version.
- `loadPreferences(storage)`: load and normalize the preference entry; missing, malformed, or unavailable storage returns defaults without affecting game startup.
- `savePreferences(preferences, storage)`: persist the supported preference shape without touching game saves. Handle unavailable or failing storage without throwing through the app.

Store the preferences as the JSON envelope `{ version: 1, textScale, reduceMotion }`. Supported `textScale` values are `1`, `1.125`, and `1.25` (100%, 112.5%, and 125%). `reduceMotion` is a boolean and defaults to `false`, which follows the operating system. Unknown schema versions fall back to defaults.

Preference writes are best-effort. When storage is unavailable or a write fails, the newly selected values still apply for the current session; the app does not crash or revert the current UI. Preferences must not alter autosave/backup contents, the canonical game save schema, progression, or content.

## Settings and accessibility behavior

- Add an accessible Settings entry point and modal dialog with clearly labeled controls for text scale and the Always reduce motion option. The scale choices are 100%, 112.5%, and 125%.
- Opening the dialog moves keyboard focus into it. Escape closes it, and closing restores focus to the control that opened it. Keep keyboard navigation and control labels available to screen readers.
- Apply text scale through a root CSS custom property using a browser-relative 100% base, not a fixed 16px root size. Check that computed root and body font sizes both scale by 1.25 at the 125% setting. Check wrapping, clipping, scrolling, and dialog sizing at 125%, including mobile widths.
- Compute effective reduced motion as `OS prefers-reduced-motion OR user reduceMotion`. The user setting may opt into more reduction, but can never override an OS request to reduce motion. Pass the effective value into `CompletionSequence`; keep other existing reduced-motion styling consistent with the same effective preference.
- Apply preference changes immediately in the running session, then attempt to persist them.

## Scope boundaries

- Do not add audio settings, sound assets, playback, or audio-related preferences.
- Do not put preferences into autosaves, backups, imports, or the game save schema.
- Do not change game content, IDs, ordering, progression, or stored world positions.
- Keep the independent two-chapter human playthrough and content-expansion gate active.

## Acceptance criteria

- A fresh or invalid preference record uses 100% text scale and follows the system motion preference.
- Supported text scales apply across the app and remain usable at 125% on desktop and mobile without clipped Settings controls or inaccessible content.
- The Always reduce motion option enables reduced motion even when the OS allows motion. When the OS requests reduced motion, turning the user control off does not restore motion.
- `CompletionSequence` receives effective reduced-motion state, including live changes to the OS preference and user setting.
- The Settings dialog has labeled controls, moves focus inside on open, closes on Escape, and restores focus to its opener.
- Missing, malformed, unknown-version preferences, unavailable storage, and write failures do not prevent the game from loading. Valid changes persist across reload when storage works; changed values remain active for the session when it does not.
- Preference storage remains separate from game save, backup, import/export, and progression data.

## Focused validation plan

The Test Engineer added these focused regressions:

- Unit: `tests/unit/game-foundation/user-preferences.test.mjs`
- Unit command: `node --test --test-isolation=none tests/unit/game-foundation/user-preferences.test.mjs`
- E2E: `e2e/lab/preferences.spec.js`
- Focused E2E command: `npm run test:e2e -- --workers=1 e2e/lab/preferences.spec.js`

Unit coverage includes the exported key/defaults, valid and invalid normalization, supported scale values, version handling, missing/malformed/unavailable storage fallback, successful persistence, and write-failure behavior. Browser coverage includes Settings labels and keyboard focus behavior, Escape and focus restoration, persistence across reload, immediate 125% scaling, the 390 × 480 mobile viewport, effective motion behavior for OS and user combinations, live OS reduced-motion changes while the ending is open, and absence of preference values from the game save.

For the 125% browser check, assert that both root and body computed font sizes are 1.25 times their 100% baselines.

Pre-implementation unit baseline: `node --test --test-isolation=none tests/unit/game-foundation/user-preferences.test.mjs` failed the single test file before tests ran with `ERR_MODULE_NOT_FOUND` for `src/game/preferences/preferences.js` (14.94 ms; parent reproduced).

Pre-implementation E2E baseline: `npm run test:e2e -- --workers=1 e2e/lab/preferences.spec.js` failed during test collection, before a worker or test case started, with `ERR_MODULE_NOT_FOUND` for the same missing module. `node --check` passed on both test files.

Review-driven unit red baseline: after adding the explicit unknown-version regression, `node --test --test-isolation=none tests/unit/game-foundation/user-preferences.test.mjs` reported 1/9 failing because `normalizePreferences` preserved version 2 instead of returning defaults; the other 8 tests passed.

Final focused verification after the fix: `node --test --test-isolation=none tests/unit/game-foundation/user-preferences.test.mjs` passed 9/9; `npm run test:e2e -- --workers=1 e2e/lab/preferences.spec.js` passed 5/5, including the 390 × 480 layout case, root/body 125% computed-font-size checks, and live OS reduced-motion changes; `npm run build` passed with Vite 8.3.5. Code Reviewer confirmed both findings resolved and no remaining issues. The full test suite was not run.

Run focused tests and the production build only for this milestone. Do not run the full test suite without user approval as required by `AGENTS.md`.

## Handoff and completion

The Architect owns the preference contract and interaction scope. The Test Engineer owns the focused unit and browser regressions. Implementation should preserve game save and progression behavior. The Code Reviewer should check data isolation, OS motion precedence, storage failure handling, dialog accessibility, and 125% responsive layouts. The Documentation Specialist records final verification and archives this plan after implementation, review, and documentation are complete.

- [x] Record the preference contract, focused test paths, coverage, and pre-implementation baselines.
- [x] Implement separate versioned preference storage and the accessible Settings dialog.
- [x] Pass focused unit/E2E checks and build.
- [x] Complete final Code Reviewer confirmation with no remaining issues.
- [x] Keep `docs/plans/browser-scaling-playtest-gate.md` active and content expansion gated.

Do not archive this plan until the milestone is implemented and reviewed. The human playthrough remains a separate active gate.
