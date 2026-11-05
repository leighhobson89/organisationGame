# Plan: Add 175% and 200% In-App Text Scale Choices

**Status:** Completed 2026-11-05.

## Goal

Extend the in-app text-size preference from its previous 100%, 112.5%, 125%, and 150% choices to include 175% and 200%, preserving preference compatibility and keeping compact layouts usable.

## Scope and implementation

- Added 175% and 200% choices to Settings and accepted both values in the existing version 1 preference normalization/storage envelope.
- Kept the preference key, envelope version, default scale, and game-save format unchanged.
- Added compact 200% layout rules for the Settings dialog, fresh 320 × 360 world, and single-item Inspector. The fresh-start toolbar and hint clear the first calibration clue; Inspector content scrolls internally and toolbar labels fit their controls.
- Added regression coverage for preference round trips, Settings persistence and scrolling, first-clue visibility and hit testing, toolbar text and keyboard reachability, and long-clue Inspector layout and scrolling.
- No authored story, game balance, progression, or game-save changes were made.

## Acceptance

- Settings offers all six scales: 100%, 112.5%, 125%, 150%, 175%, and 200%.
- 175% and 200% normalize, save, load, and persist after reload in the unchanged version 1 preference envelope; unsupported 2.125 falls back to the default.
- At 320 × 360, the fresh world, Settings dialog, and single-item Inspector remain usable at 200% without page-level horizontal overflow. Internal scrolling and keyboard access remain available; the first clue is visible and center hit-testable.
- Existing 150% checks remain passing.
- The independent human chapter playtest remains deferred; content expansion remains gated by `browser-scaling-playtest-gate.md`.

## Verification

- Red baseline: unit tests passed 12/14; the two new values were normalized back to 100%. Three initial focused E2E cases failed because 200% was absent or rejected. The added first-clue regression also caught toolbar overlap, and layout runs exposed clipped labels and cramped Inspector/Settings content.
- `node --test --test-isolation=none tests/unit/game-foundation/user-preferences.test.mjs` passed 14/14.
- `npm run test:e2e -- --workers=1 e2e/lab/preferences.spec.js e2e/lab/mobile-toolbar.spec.js e2e/lab/inspector-panel-layout.spec.js` passed 53/53.
- `npm run build` passed with Vite 8.3.5 (59 modules).
- Scoped source review confirmed preference and game-save compatibility; no remaining issues were identified in the requested slice.
- The full test suite was not run.

## Limitations

Automated layout and interaction coverage is not an independent human playthrough. The independent research-chapter playtest was deferred by the user and remains open; do not treat this work as clearing the content-expansion gate.

## Related documentation

- [Architecture](../../ARCHITECTURE.md)
- [Testing guide](../../TESTING_GUIDE.md)
- [Roadmap](../../ROADMAP.md)
- [Open browser scaling and playtest gate](../../plans/browser-scaling-playtest-gate.md)
