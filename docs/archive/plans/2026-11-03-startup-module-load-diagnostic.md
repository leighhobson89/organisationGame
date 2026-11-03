# Plan: Startup Module Load Diagnostic

**Status:** Complete. The accessible diagnostic is implemented, focused verification passed, review found no actionable findings, and the README and testing guide are updated.

## Goal and boundary

Show a useful, accessible message when the browser cannot load the app's JavaScript entry module. A static server can return `/src/main.jsx` as `text/jsx`, which the browser rejects for a module script. The diagnostic directs source users to run `npm run dev` and open the URL printed by Vite.

The change is limited to startup failure reporting in `index.html`. It does not change application state, game content or catalog data, save formats, or the active browser-scaling and human-playtest gate.

## Implementation

- Added a hidden, readable diagnostic with `role="alert"` to `index.html` and minimal inline styling, so the message remains legible if app CSS never loads.
- Before the module entry executes, a small classic inline script registers a capture-phase `error` listener on `window`. It reveals the alert only when the event target is an external `<script type="module">` element.
- The listener does not rely on an entry-script ID or hard-coded source URL. It ignores ordinary runtime errors, whose event target is `window`.
- The message identifies an app-code loading failure and directs source users to `npm run dev` and Vite's printed URL without asserting a single cause.

## Regression and verification

The Test Engineer added `e2e/startup.spec.js`. It intercepts the module request by pathname/query and returns a successful HTTP response with the `text/jsx` MIME type. The E2E verifies the request was intercepted and that the accessible alert becomes visible with actionable development-server guidance. The tests also cover normal startup.

The first red baseline, `npx playwright test e2e/startup.spec.js --reporter=line`, failed 1/1 because no `role="alert"` appeared after the intercepted response. The final focused run of the same command passed 2/2. The actual Vite-served development HTML has no entry-script ID, so the regression uses that HTML directly; it does not simulate a production rewrite or remove an ID.

`npm run build` passed with Vite 8.3.5. Code Reviewer found no actionable findings. The full test suite was not run.

## Documentation and handoff

The README now notes that the page displays recovery guidance if the entry module fails, while retaining its Vite versus static-server explanation. `docs/TESTING_GUIDE.md` records the focused Playwright command and final result. The separate active browser-scaling and human-playtest plan remains unchanged.

## Acceptance criteria

- [x] A failed entry module reveals a readable accessible `role="alert"` diagnostic.
- [x] The diagnostic is hidden on successful startup and styled without relying on app CSS.
- [x] A capture-phase window listener detects failed external module scripts without relying on an ID or source URL and ignores runtime errors.
- [x] The message gives source users the `npm run dev` and Vite-printed-URL steps.
- [x] The focused MIME-mismatch E2E regression passed 2/2; the production build passed with Vite 8.3.5; review found no actionable issue.
- [x] The pre-implementation red baseline is recorded: the focused test failed 1/1 because no alert appeared after the intercepted MIME-mismatch response.
- [x] The README and testing guide were updated; this finalized plan is archived at `docs/archive/plans/2026-11-03-startup-module-load-diagnostic.md`.
