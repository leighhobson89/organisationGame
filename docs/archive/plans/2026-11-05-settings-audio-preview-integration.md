# Plan: Verify Settings Audio Preview Integration

## Goal

Cover the browser integration from a Settings user gesture through the WebAudio adapter and back to accessible preview feedback.

## Scope and constraints

- Add a deterministic E2E case in `e2e/lab/preferences.spec.js` with an injected fake `AudioContext`.
- Use a trusted browser click to enable sound and verify the fake context is created and unlocked; click **Preview sound** and verify oscillator scheduling plus the visible `role="status"` text **Preview played**.
- Keep audio disabled at the start of the scenario and avoid relying on a real audio device or browser audio output.
- This verifies UI-to-adapter wiring and status feedback. It does not establish that a human can hear the preview.
- Keep the active browser-scaling and human-playtest gate unchanged.

## Verification

- Run the focused Settings E2E case, then `npx playwright test e2e/lab/preferences.spec.js`.
- Assert constructor/resume activity follows the trusted enabling gesture, oscillator nodes are scheduled only after Preview is clicked, and the accessible status reports success.
- Do not run the full test suite.

## Test plan

- Focused command: `npx playwright test e2e/lab/preferences.spec.js --grep "Settings plays the sound preview through the Web Audio adapter"`.
- Result: passed 1/1 with visible `Preview played`, one context creation and resume, two notes, stop schedules, and connected audio nodes.

## Result

- The focused E2E case passed 1/1, and `npx playwright test e2e/lab/preferences.spec.js --workers=1` passed 17/17.
- `git diff --check` found no whitespace errors; only expected LF-to-CRLF notices were reported.
- Scoped Code Reviewer found no actionable findings. No production source changed, and the full suite was not run.
- The deterministic fake context verifies UI-to-adapter wiring and visible status; it does not test human audibility. The active human-playtest gate remains unchanged.
