# Plan: Production Preview Smoke Check

**Status:** Completed and reviewed on 2026-11-04. The opt-in browser check covers the built app served by Vite Preview. It does not certify release readiness or close the separate human-playtest/content-expansion gate.

## Goal and boundary

Add an isolated Playwright smoke test for the production build. It should catch production-only module-loading, MIME, or worker URL failures and verify one real filing survives autosave and reload. Keep the existing Vite development workflow and default E2E discovery unchanged. Do not add support for arbitrary static servers.

## Implementation

1. Added `playwright.production.config.js` and the root-level `production-tests/production-smoke.spec.js`, outside default E2E discovery.
2. The dedicated config builds the project and serves `dist/` through Vite Preview on `127.0.0.1:5183`.
3. The smoke test checks module/worker responses and MIME types, no missing assets or browser errors, files `calibration-card-01` into `cabinet-calibration`, waits for autosave, reloads, and confirms the saved placement.
4. Added the `npm run test:e2e:production` command.
5. Added `public/favicon.svg` and linked it from `index.html` after the baseline exposed a missing `/favicon.ico` request.

## Acceptance criteria

- Default E2E discovery does not include the production smoke test.
- The dedicated command builds and starts Vite Preview before the browser test.
- JavaScript module responses have executable JavaScript MIME types; no module-load or runtime errors occur during initial load or reload.
- The calibration card is correctly filed, autosaved, and still filed after reload.
- Development instructions and the deferred human playtest/content-expansion gate remain accurately documented.

## Test plan

The Test Specialist added `playwright.production.config.js` and `production-tests/production-smoke.spec.js`. The dedicated config keeps the test outside default E2E discovery and builds then serves the app through Vite Preview.

Focused command: `npm run test:e2e:production`.

The pre-implementation baseline reached the production app and passed the JavaScript module status/MIME checks, filing `calibration-card-01`, autosave decoding, reload, and persisted placement assertions. It failed only at the final no-request-errors assertion: Preview returned 404 for `/favicon.ico`. The initial sandbox attempt could not spawn the browser process (`spawn EPERM`); the focused run with process access reached the application and exposed the favicon failure.

## Verification results

The focused production-preview run passed **1/1** after the favicon was added. It verified successful JavaScript module/worker responses and MIME types, no failed asset requests or browser errors, correct filing and autosave, and restored placement after reload. The sandbox attempt returned Windows `spawn EPERM`; retrying with process access passed. Scoped Code Reviewer found no actionable issues. `git diff --check` reported no whitespace errors; it emitted only expected LF-to-CRLF conversion notices for README, `index.html`, and `package.json`. The full test suite was not run.

Documentation was updated in README, the Testing Guide, and the Roadmap. The independent human playtest remains deferred and content expansion stays gated.
