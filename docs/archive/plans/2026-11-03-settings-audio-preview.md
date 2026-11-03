# Plan: Settings Audio Preview

**Status:** Complete. Settings can audition the optional synthesized audio without advancing the game. This does not complete human listening-quality review or the independent two-chapter playtest gate, and it does not unblock content expansion.

## Goal and boundary

Let a player audition the optional synthesized sound effects directly from Settings. Preserve the default-muted preference, trusted-gesture audio unlock, transient gameplay event behavior, and game-save schema. The preview must not publish a gameplay event or change placements, progression, discoveries, or saves.

## Implementation outline

- Add a short, restrained preview motif to the existing Web Audio adapter and expose a `preview()` operation. It should use the same gesture-based AudioContext unlock path, return whether playback could be scheduled, and remain separate from the stable gameplay event catalog.
- Add a **Preview sound** control and concise explanation in Settings. Keep it disabled while sound effects are off. Announce whether a preview played or could not be played using a dedicated status region.
- Route the Settings action through the application audio adapter. Unsupported audio and playback failures remain optional and must not interrupt Settings or gameplay.
- Keep audio preferences outside game saves. Preserve the existing deferred playtest plan and content-expansion gate.

## Verification scope

### Test plan

- Unit: run `node --test --test-isolation=none tests/unit/game-foundation/web-audio-adapter.test.mjs`. Verify that an enabled preview unlocks and schedules the private cue without publishing a gameplay event; muted and unsupported previews schedule nothing; muting stops an active preview; and rejected unlock remains non-fatal and can be retried.
- Browser: run `npm run test:e2e -- --workers=1 e2e/lab/audio-settings.spec.js`. Verify that Preview sound is disabled by default, enabling sound effects permits a preview with an announced result, the preview does not change progression or autosave, muting disables the control and stops playback, and unavailable Web Audio is announced accessibly.

### Red baseline

- The focused adapter unit command produced 8 passes and 4 expected failures because `adapter.preview()` was not implemented.
- The focused audio-settings E2E produced 2 existing passes and 2 expected failures because the Preview sound control was absent. The first default sandbox attempt stopped with Windows `spawn EPERM`; the focused retry with process access reached the expected baseline failures.

### Final verification

- `node --test --test-isolation=none tests/unit/game-foundation/web-audio-adapter.test.mjs` passed 12/12.
- `npx playwright test e2e/lab/audio-settings.spec.js --workers=1` passed 4/4, including opt-in, status announcements, event isolation, and unchanged progression/autosave.
- `npm run build` passed with Vite 8.3.5.
- Code Reviewer re-review found no actionable findings. The initial review noted that rate-limiting or cue saturation could be mislabeled as unavailable audio; the status now uses the accurate general message **Preview could not be played**.
- The default sandbox blocked Vite and Playwright process spawning with Windows `spawn EPERM`; the focused browser run and final build passed with process access.
- The full test suite was not run. Human listening-quality review and the independent human-playtest/content-expansion gate remain open.

The implementation and results are recorded in `docs/ARCHITECTURE.md`, `docs/TESTING_GUIDE.md`, `docs/ROADMAP.md`, and `docs/VERTICAL_SLICE.md`. The active `docs/plans/browser-scaling-playtest-gate.md` remains the only plan in `docs/plans/`.

## Acceptance criteria

- Preview playback uses a private audio cue and does not enter or mutate the gameplay event stream.
- The preview is accessible, disabled while muted, and clearly reports whether it played.
- Previewing leaves game state, progression, preferences beyond the sound toggle, and game saves unchanged.
- Focused tests and build pass; review finds no actionable issues; the independent human-playtest/content-expansion gate remains open.
