# Plan: Production Preview Release Smoke Refresh

**Status:** Finalized; isolated production-preview smoke verified on an alternate port after the configured port conflicted.

## Goal and rationale

Refresh confidence in the isolated production-preview smoke after recent 200% text and responsive CSS work. The existing smoke predates those changes, so rerun it against the built artifact served by Vite Preview before treating its release signal as current. This remains a focused production smoke, not a full release certification or closure of the independent human-playtest/content-expansion gate.

## Scope and constraints

- Run the existing `npm run test:e2e:production` command using `playwright.production.config.js` and `production-tests/production-smoke.spec.js`.
- Verify the command builds the app and serves `dist/` through Vite Preview, then exercises the production page in the browser.
- Verify JavaScript module and worker responses use executable JavaScript MIME types, with no runtime errors or missing asset requests on initial load or reload.
- Verify the fresh `calibration-card-01` can be filed into `cabinet-calibration`, autosaves, and remains filed after reload.
- Make a change only if the smoke exposes a production entry, asset, or runtime failure; keep any fix limited to that failure.
- Do not run the full E2E or unit suite. Preserve default E2E discovery and the independent human-playtest/content-expansion gate.

## Implementation approach

1. Run the existing focused `npm run test:e2e:production` smoke against the current production build and Vite Preview server.
2. If the configured port prevents the test from starting, verify listener state read-only and validate the same smoke with a temporary configuration on an alternate port; remove the temporary config afterward and keep the repository production config unchanged.
3. If a smoke assertion fails after the browser starts, identify whether it comes from the production entry, assets, JavaScript/worker MIME, runtime, or filing/autosave/reload path; fix only the demonstrated production issue.
4. If any implementation change is needed, rerun the focused smoke and perform scoped review; update the Testing Guide and Roadmap, and archive the finalized plan. When verification requires no repository changes, record that no source/config/test review was needed.

## Test plan

The Test Engineer ran `npm run test:e2e:production` twice. Both attempts failed before browser/test execution because port 5183 was reported already in use. Immediate read-only listener checks found no listener. No production assertion was reached and no source or repository configuration change was made. The Test Engineer is validating the same isolated smoke with a temporary alternate-port configuration, then will remove that temporary config; the standard production command/configuration remains unchanged.

The equivalent isolated smoke passed using `npx playwright test --config=playwright.production.smoke.temp.config.js`. After confirming port 5184 was free, the temporary configuration changed only the three references to port 5183 to use port 5184. It passed 1/1 in 5.8 seconds and verified production-preview modules load and `calibration-card-01` remains filed after reload. The first sandbox run returned `spawn EPERM`; the process-access rerun passed. The temporary config was removed, and repository config, package scripts, tests, and production source remained unchanged.

## Acceptance criteria

- [x] The existing `npm run test:e2e:production` command was attempted twice but stopped before test execution because configured port 5183 was reported occupied; immediate read-only listener checks found no listener. The equivalent isolated smoke passed through Vite Preview with only the temporary port changed to 5184. The temporary config was removed and repository configuration is unchanged.
- [x] The focused smoke verified JavaScript module/worker MIME and responses, with no runtime errors or missing asset requests on load or reload.
- [x] The fresh calibration card filing autosaves and survives reload.
- [x] No production source, package script, repository test, or committed production config changes were needed; default E2E discovery remains unchanged.
- [x] No full suite was run; documentation is updated, the finalized plan is archived, and the separate human-playtest/content-expansion gate remains active.
