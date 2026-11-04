# Plan: 150% Text Size Preference

**Status:** Complete. A persistent 150% text-size option is implemented and focused-verified without changing the preference envelope or game save format.

## Goal and boundary

Offer a 150% text-size setting for players who need larger interface text. Preserve the existing version 1 preference envelope, keep preferences separate from game saves, and retain the current 100%, 112.5%, and 125% behavior. This accessibility polish does not change game content or close the independent human-playtest/content-expansion gate.

## Proposed implementation

- Add `1.5` to the supported preference scales and expose it as a labeled 150% option in Settings.
- Apply the existing root `--text-scale` mechanism and persist the setting in the existing preferences key and envelope.
- Adjust responsive styles only where focused checks demonstrate clipping, overlap, or unreachable controls at 150%.

## Test plan

The Test Engineer added focused coverage for the preference contract and the key compact UI surfaces:

- Unit: `tests/unit/game-foundation/user-preferences.test.mjs` verifies that 150% normalizes, saves, and reloads through the existing version 1 envelope.
- E2E: `e2e/lab/preferences.spec.js` selects both 125% and 150%, verifies immediate root/body scaling, persistence in the version 1 preference envelope, restoration after reload, and separation from game-save data. At 320×480 and 390×480 for both scales, the dialog shell, close button, and Done action remain in the viewport; the text-size and reduce-motion fields can be reached through internal scrolling and focused within `.settings-dialog__content`.
- E2E: `e2e/lab/header-responsive-layout.spec.js` verifies that all mobile header controls remain reachable without clipping at 150% and both compact widths, while retaining the 125% cases.
- E2E: `e2e/lab/mobile-toolbar.spec.js` verifies toolbar, hint, and selection-toast bounds and text clipping at 150% and both compact widths, while retaining the 125% cases.

Focused commands:

```sh
node --test --test-isolation=none tests/unit/game-foundation/user-preferences.test.mjs
npm run test:e2e -- --workers=1 e2e/lab/preferences.spec.js e2e/lab/mobile-toolbar.spec.js e2e/lab/header-responsive-layout.spec.js
```

## Scope and constraints

- Preserve the version 1 preference storage shape and game save schema; no migration or save-format change is expected.
- Keep the existing options and behavior at 100%, 112.5%, and 125%.
- Cover Settings, the laboratory header, world toolbar, and first-action guidance at compact 320×480 and 390×480 viewports.
- Verify selection through Settings, persistence across reload, and separation from game-save data.
- Do not expand authored content or close `docs/plans/browser-scaling-playtest-gate.md`.

## Acceptance criteria

- Settings exposes 100%, 112.5%, 125%, and 150% text sizes.
- A selected 150% preference is accepted, applied immediately, and restored after reload without changing the stored game save.
- Settings and compact header, toolbar, and hint remain readable, in bounds, and operable at 320×480 and 390×480 at 150%.
- Existing 100–125% preference, responsive, and accessibility behavior remains covered and passing.
- Relevant documentation is updated, the finalized plan is archived under `docs/archive/plans/` with a dated descriptive filename, and `docs/plans/` contains only intentionally active plans.

## Implementation and verification

Added 150% to the supported preference values and Settings while retaining the version 1 preference envelope and existing game-save format. At both 320×480 and 390×480, Settings keeps its shell, close button, and Done action in the viewport; the text-size and reduce-motion fields are reachable by internal scrolling and can receive focus within `.settings-dialog__content`.

The user-preferences unit tests passed 12/12. The focused Settings, mobile-toolbar, and responsive-header E2E specs passed 38/38, covering 125% and 150% preference selection and persistence, reload restoration, save separation, compact control reachability, and layout readability. Scoped Code Reviewer found no actionable findings. No production build or full suite was run. The independent human-playtest/content-expansion gate remains open.
