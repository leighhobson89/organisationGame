# Keyboard gesture audio unlock

**Status:** Complete. Focused browser coverage confirms a trusted keyboard gesture unlocks one audio context and keyboard filing plays a gameplay cue. Existing app behavior passed without changes.

## Goal

Protect the keyboard path that unlocks gameplay audio when sound effects are enabled. A keyboard user should be able to activate an item and file it, with the audio context unlocked by the trusted key event and a gameplay cue played after the correct placement.

## Scope

- Seed a fresh browser page with sound effects enabled using the existing versioned preferences record.
- Use the existing fake `AudioContext` instrumentation to observe construction, resume, and oscillator activity.
- Confirm no audio context or oscillator is created before a user gesture.
- Focus a calibration card without pointer input and press Enter; confirm the trusted key gesture constructs and resumes exactly one audio context without starting a cue on selection.
- Choose Cabinet Calibration from the focused destination control using three ArrowDown presses, focus Move to file, and press Enter.
- Confirm the destination reports one of eight objects and a gameplay oscillator starts.
- Keep the existing pointer gameplay test and the runtime event catalog unchanged.

## Boundaries

- Preserve the optional audio preference, its default, cue design, event catalog, saved game data, and pointer behavior.
- Do not add game content or change progression.
- If the regression fails, restrict implementation changes to the trusted-gesture capture and audio-unlock handler in `src/app/App.jsx`.
- The independent human playtest and content-expansion gate remain open; this check does not satisfy that gate.

## Test plan and baseline

- In `e2e/lab/audio-settings.spec.js`, seed a fresh page with version 1 preferences and `soundEffectsEnabled: true`, then install a fake AudioContext that records construction, resume, and oscillator starts.
- Confirm context construction, resume, and oscillator counts begin at zero.
- Focus `lab-item-calibration-card-01` programmatically and press Enter as the trusted keyboard gesture. Confirm exactly one context construction and resume, while selection starts no oscillator.
- Focus `move-target`, press ArrowDown three times to choose `cabinet-calibration`, then focus `move-item` and press Enter.
- Confirm the destination reports one of eight objects, playback starts, and the same single context remains in use.
- Keep the existing pointer gameplay test unchanged.
- The focused command `npm run test:e2e -- --workers=1 e2e/lab/audio-settings.spec.js` passed 5/5, including the keyboard-only path. The regression passes with the current app handler, so no runtime source change was needed.

## Verification

- Focused Playwright coverage in `e2e/lab/audio-settings.spec.js` passed 5/5, including the keyboard-only unlock and gameplay cue path.
- `npm run build` passed with Vite 8.3.5 (59 modules).
- Code Reviewer found no actionable findings. No runtime code or app behavior changed.
- The full test suite and manual listening/playtest were not run; the corresponding human gates remain open.

## Acceptance criteria

- A trusted keyboard event unlocks one audio context when effects are enabled.
- Selection alone creates no oscillator; keyboard filing to the correct Cabinet Calibration destination emits an observable cue.
- The existing pointer test continues to cover the pointer path.
- Focused E2E and build pass, and review finds no actionable issues.
- The deferred human-playtest/content-expansion gate remains active.
