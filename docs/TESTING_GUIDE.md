# Testing Guide

This guide describes how to choose and write tests as the project grows.
Playwright is the intended model for browser E2E tests. The harness has not
been established yet. The test command contract below is planned guidance, not
an available command today; exact Playwright and browser versions, options, and
artifact paths remain to be set with the harness.

## Choose the narrowest useful test layer

Start with the smallest layer that can verify the behavior:

- Use unit or other headless tests for calculations, rules, validation, state
  changes, and edge cases that do not depend on a browser.
- Use browser end-to-end (E2E) tests for important journeys whose success is
  visible to a user or depends on the application working as a whole.
- Add browser coverage for a regression when the defect depends on browser
  behavior or integration across user-visible parts of the application.

Keep browser tests focused on outcomes. Avoid repeating every lower-level
case in E2E tests when a headless test can cover it clearly.

## Organize tests by functional area

Use the same stable functional-area names for both test layers:

- Unit tests: `tests/unit/<functional-area>/*.test.*`
- Browser E2E tests: `e2e/<functional-area>/*.spec.*`

An area may have unit tests, browser E2E tests, or both. Unit tests do not need
browser setup. Keep area names consistent across the two locations so a
functional-area selection can find coverage in either layer.

## Browser E2E practices

Use Playwright to exercise the application through its browser interface.
Interact with controls as a user would: use mouse and keyboard actions, enter
and submit form values, and follow visible navigation. Prefer stable,
accessibility-oriented locators such as roles and accessible names, labels, and
placeholders where appropriate. Avoid selectors tied to incidental markup or
implementation details.

Verify observable results, such as a confirmation becoming visible, a form
showing validation, or navigation reaching the expected destination. Wait for
those conditions or other meaningful application state. Do not use arbitrary
fixed sleeps to make a test pass.

## Determinism and isolation

Each test should establish the state it needs and be safe to run independently
or in a different order. Use controlled, repeatable fixtures and inputs; avoid
depending on leftover state, live external services, timing luck, or a specific
test having run first. Clean up or isolate state that could affect another
test.

When a test fails, make it possible to reproduce with the same inputs and
setup. Keep test data explicit and avoid environment-dependent assumptions
unless the test is specifically checking that environment.

## Headless and headed runs

Run browser tests headlessly by default for routine checks. Use headed mode to
diagnose visual or interaction problems. Headed and headless runs should use
the same tests, configuration, data setup, and pass criteria; headed mode is a
diagnostic view, not a separate test standard.

## Failures and useful evidence

When a test fails, preserve enough information to understand and reproduce the
failure. Depending on the harness, useful evidence can include the failing
assertion, browser console and page errors, application logs, a screenshot, or
a browser trace. Record the relevant test, inputs, and setup when reporting a
failure. Keep artifact locations consistent with the harness documentation.

## Updating coverage

When behavior changes, add or update focused regression coverage for the new
behavior and its important boundaries. Update browser E2E coverage when the
change affects a user-visible journey or browser integration. Keep assertions
about outcomes users or other code rely on, and revise obsolete expectations
when behavior intentionally changes.

## Running tests

Run focused tests for the requested functional area as the default verification
step. Ask the user for approval before running the full test suite, as required
by `AGENTS.md`.

## Future `npm run tests` contract

When the harness is implemented, `npm run tests` is intended to follow this
contract:

- No area arguments run all unit and browser E2E tests.
- One or more area names filter both layers to the matching functional areas.
  An area with only one layer runs only the tests in that layer.
- An unknown area fails clearly and lists the available area names.
- Repeating an area name does not run its tests more than once.

Planned examples:

```sh
npm run tests
npm run tests functionalArea1
npm run tests functionalArea1 functionalArea2
```

These examples describe a future contract; do not treat the command as
available until the harness implements it. The no-argument form is a full test
suite and requires user approval before it is run.

## Future harness architecture and run surface

When the harness is designed, provide clear run surfaces for:

- Headless unit tests for behavior that does not require a browser.
- Focused browser E2E runs, selectable by a test or functional area.
- Full browser E2E runs covering the broader end-to-end suite. Ask for user
  approval before running a full test suite, as required by `AGENTS.md`.
- Headed browser diagnostics for investigating visual or interaction failures.
  They should use the same tests, configuration, data setup, and pass criteria
  as headless browser runs; headed mode changes visibility and diagnostic
  evidence, not what counts as a pass.

The harness should manage the application server for browser E2E: start it,
wait for an observable readiness condition, provide the test base URL, and
shut it down after the run, including when a run fails. Document how this
lifecycle works once the harness is selected.

For failures, produce a test report and useful diagnostics such as screenshots,
browser traces, console/page errors, and application logs when available.
Document where reports and artifacts are written and how long they are retained
so a failure can be investigated after the run.

Once the harness is established, record any exact command options, fixture and
data setup, supported Playwright/browser versions, server lifecycle, and
report/artifact paths and retention. Until then, treat those details as TBD;
do not assume versions, options, paths, or setup before they exist.
