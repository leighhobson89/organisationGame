# Plan: Focused Release-Readiness Verification

**Status:** Complete. Focused release verification passed across production build/loading, gameplay, accessibility, persistence, responsive layouts, and the structural performance regression. The independent human-playtest/content-expansion gate remains open.

## Goal and boundaries

Audit the current test inventory and run the narrowest relevant existing checks for the principal release risks:

- Startup and production module loading.
- Core organizing and both research chapter interactions.
- Keyboard access, accessibility preferences, and reduced motion.
- Save migration, autosave recovery, manual save, and import-failure safety.
- Responsive header, panels, toolbars, and key gameplay surfaces.
- The opt-in 174/5,024-item structural performance regression, if the available browser environment can run it.

Use fresh Playwright contexts and fixtures already defined by the tests. Do not change the user's browser save, add content, run the full unit/E2E suite, or close the human-playtest/content-expansion gate. This is a verification pass; if a release-blocking defect appears, record the evidence and stop that affected group for a separate implementation handoff.

## Planned focused checks

- `npm run build` — verify the production bundle.
- `npm run test:game` — verify focused core game-system rules and transitions.
- `node --test --test-isolation=none tests/unit/game-foundation/manual-saves.test.mjs tests/unit/game-foundation/user-preferences.test.mjs tests/unit/game-foundation/web-audio-adapter.test.mjs` — verify manual-save and preference persistence, including sound-cue adapter behavior.
- `npm run test:e2e:production` — build and serve a production preview; verify module/worker MIME, runtime/assets, then calibration-card filing and reload.
- `npm run test:e2e -- --workers=1 e2e/startup.spec.js e2e/lab/organising-loop.spec.js e2e/lab/research-chapter.spec.js` — verify the startup MIME diagnostic, organizing loop, keyboard movement and recovery, scratch pads, collection rewards, puzzles, chapter progression, and Engine stages.
- `npm run test:e2e -- --workers=1 e2e/lab/preferences.spec.js e2e/lab/header-responsive-layout.spec.js e2e/lab/mobile-toolbar.spec.js e2e/lab/full-restoration-ending.spec.js e2e/lab/chronology-puzzle-panel-layout.spec.js e2e/lab/audio-settings.spec.js` — verify text/reduced-motion preferences, responsive header and controls, compact layouts, ending/puzzle accessibility, and opt-in audio settings and preview behavior.
- `npm run test:e2e -- --workers=1 e2e/lab/inspector-panel-layout.spec.js e2e/lab/notebook-panel-layout.spec.js e2e/lab/skills-panel-layout.spec.js e2e/lab/item-finder-layout.spec.js e2e/lab/world-atlas.spec.js` — separately verify responsive Inspector, Notebook, Skills, Finder, and Atlas layouts.
- `npm run test:e2e -- --workers=1 e2e/lab/manual-saves.spec.js e2e/lab/world-and-save-recovery.spec.js` — verify manual slots, migrations, autosave and corruption recovery, valid/rejected imports, and backup-failure behavior.
- `npx playwright test e2e/lab/research-chapter.spec.js --workers=1 --grep "v2 migration preserves the old placement and the chapter gate, compass, and chronology can be completed"` — verify the migrated chapter journey and chronology persistence path.
- `npm run test:e2e:performance -- --workers=1` — verify the isolated 174/5,024-item structural and interaction regression.

The structural performance regression does not replace the timed benchmark. Human chapter playthrough and audio listening-quality review also remain external evidence gaps; automated verification cannot close them.

## Acceptance criteria

- Each planned focused group records its command and pass/fail/blocked result.
- Production loading, core progression, keyboard/accessibility/reduced motion, persistence/recovery, and responsive UI have direct current test evidence.
- The optional structural performance regression is either run or clearly recorded as unavailable, without substituting benchmark evidence.
- No full suite runs without the approval required by `AGENTS.md`.
- Any release-blocking failure is reported with its exact test and reproducible evidence; no unrelated fixes are mixed into this verification plan.
- `docs/plans/` remains active until results and any required follow-up handoffs are documented. The browser playtest/content-expansion gate stays open.

## Results

- `npm run build` passed with 61 modules after the sandbox returned `spawn EPERM` and the process-access retry passed.
- `npm run test:game` passed 60/60. The focused manual-saves, user-preferences, and Web Audio adapter unit files passed 35/35.
- The configured `npm run test:e2e:production` could not start because port 5183 was occupied by an existing listener; it was left running. The equivalent `npx playwright test --config playwright.production.release.config.js` production smoke passed 2/2 on port 5184, and the temporary config was removed afterward.
- Startup, organizing-loop, and research-chapter E2E passed 21/21. Accessibility, reduced-motion, audio, header, mobile-toolbar, ending, and chronology E2E passed 84/84. Manual-saves/world-recovery E2E passed 39/39. Inspector/Notebook/Skills/Finder/Atlas responsive E2E passed 60/60.
- The dedicated v2 migration journey passed 1/1. The opt-in structural performance E2E passed 14/14.
- Playwright sandbox worker attempts returned `spawn EPERM`; process-access reruns passed. Scoped review found no application defect; no source changed. No full suite was run.
- Updated the Testing Guide and Roadmap, marking only the focused verification item complete. Human playthrough, audio listening-quality review, and broader visual polish remain open; the browser playtest/content-expansion gate remains active.
