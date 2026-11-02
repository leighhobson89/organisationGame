# Plan: Document the testing layout and run contract

## Scope

Update `docs/TESTING_GUIDE.md` with a proposed shared functional-area layout for
unit and browser E2E tests, plus the future `npm run tests` filtering contract.
Mark the contract as future guidance until the harness exists.

## Requirements

- Describe `tests/unit/<functional-area>/*.test.*` and
  `e2e/<functional-area>/*.spec.*`, using the same area names; an area may have
  one or both layers, and unit tests need no browser setup.
- Document no-argument, one-area, and multiple-area `npm run tests` examples.
- Require clear failures for unknown selectors and de-duplicate repeated areas.
- Preserve existing E2E, headed/headless, artifact, server, and approval guidance.

## Verification

Read through the updated guide and check the required layout, examples, future
status, and archive/plans paths. Do not add or run tests.

## Verification performed

- Read through `docs/TESTING_GUIDE.md` and checked the requested layouts,
  command examples, filtering rules, full-suite approval language, and retained
  E2E guidance.
- Confirmed the command contract is explicitly marked as future and that paths
  and exact harness details remain to be established.
- No tests were added or run.
