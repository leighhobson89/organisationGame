# Plan: Cover Keyboard Audio Preview in Settings

## Goal

Verify that keyboard users can enable sound effects and play the Settings preview through the same trusted-gesture path as pointer users.

## Scope and constraints

- Extend `e2e/lab/preferences.spec.js` and factor the existing fake `AudioContext` setup into a shared test helper for pointer and keyboard cases.
- In the keyboard case, use **Space** to enable **Sound effects**; verify one fake context is unlocked and no notes are scheduled. Then focus **Preview sound**, press **Enter**, and verify both notes are scheduled and the accessible status reports **Preview played**.
- Preserve the existing pointer-path coverage. No production source changes are expected.
- The fake context verifies keyboard-to-UI-to-adapter wiring and status, not human audibility.
- Keep the active browser-scaling and human-playtest gate unchanged.

## Verification

- Run the keyboard-focused case, then `npx playwright test e2e/lab/preferences.spec.js --workers=1`.
- Confirm context creation/resume follows the trusted Space press, oscillator scheduling begins only after Enter on Preview sound, and status is visible.
- Do not run the full test suite.
- Focused pointer and keyboard pair: `npx playwright test e2e/lab/preferences.spec.js --grep "Settings plays the sound preview|keyboard can enable sound effects"` passed 2/2 with the shared fake `AudioContext` helper.

## Result

- The pointer and keyboard cases passed 2/2; `npx playwright test e2e/lab/preferences.spec.js --workers=1` passed 18/18.
- `git diff --check` found no whitespace errors; only expected LF-to-CRLF notices were reported.
- Scoped Code Reviewer found no actionable findings. No production source changed, and the full suite was not run.
- The fake context verifies trusted keyboard UI-to-adapter wiring and status, not human audibility. The active browser-scaling/human-playtest gate remains unchanged.
