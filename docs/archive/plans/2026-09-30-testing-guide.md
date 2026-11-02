# Plan: Add a testing guide

## Scope

Create `docs/TESTING_GUIDE.md` for future contributors. Name Playwright as the
intended browser E2E model while leaving exact versions, commands, and setup to
the future harness. Do not add code, tests, or project-specific setup.

## Content

- Explain test selection, including focused unit/headless checks and browser E2E
  for visible user journeys.
- Cover deterministic setup, isolated tests, accessible locators, observable
  waits, headless defaults, headed diagnosis, and failure artifacts.
- Describe headless unit tests, focused and full browser E2E, headed diagnostics
  with matching configuration and pass criteria, managed server readiness and
  shutdown, and artifact/report retention.
- Ask for approval before a full-suite run, matching `AGENTS.md`.
- List the harness details to document once selected: commands, fixtures,
  browser, server lifecycle, and artifact paths.

## Verification

Read through the guide for scope, neutrality, and consistency with `AGENTS.md`;
inspect the changed paths. Do not run tests or add test code.

## Verification performed

- Read through `docs/TESTING_GUIDE.md` and confirmed the requested topics are
  covered, including the intended Playwright model and future run surfaces.
- Confirmed exact harness commands, versions, and paths remain TBD, with no
  source-project-specific setup details included.
- No tests or test code were added or run.
