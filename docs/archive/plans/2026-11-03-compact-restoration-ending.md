# Compact restoration ending readability

**Status:** Complete. Both compact 125% regressions pass with the current ending styles, the full focused ending spec and production build pass, and review found no actionable issues. No app behavior or CSS changed.

## Goal

Keep the full-restoration ending readable and operable when the viewport is 320×480 or 390×480 and text scale is 125%. The ending must allow the player to read its narrative and completion summary, reach all statistics, and continue exploring using the keyboard.

## Scope

- Open the ending from a fully completed game using the existing completion fixture and saved `textScale: 1.25` preference.
- Exercise 320×480 and 390×480 viewports.
- Confirm the narrative, live completion status, and all six statistic values are reachable by scrolling the dialog.
- Confirm keyboard navigation can focus **Continue exploring**, and focus places the action within the visible viewport.
- Confirm the dialog and its content do not create horizontal overflow or clip text/actions at either viewport.
- If a regression is found, restrict implementation changes to the completion dialog's layout, sizing, and scrolling rules in `src/styles/app.css`.

## Test plan and baseline

- Set the browser viewport to 320×480 and 390×480 in separate cases.
- Seed `palimpsest-laboratory.autosave.v1` with `createAlmostCompleteFixture()` and seed `palimpsest-laboratory.preferences.v1` with version 1 preferences (`textScale: 1.25`, reduced motion off, sound effects off).
- Open the actual ending through the game's completion path: find the fixture's final item in Item Finder and move it to its correct destination.
- Confirm the saved scale is active, the ending dialog scrolls, and the narrative, live status, and all six statistics can each be brought fully inside the dialog's visible scroll area.
- Starting from the focused ending heading, press Tab and confirm **Continue exploring** receives focus and remains visible inside the dialog.
- Measure the dialog, content, statistics grid, and statistic cards for horizontal scroll overflow and bounds outside the viewport.
- The two new viewport cases passed against the current CSS. No visual CSS fix is needed based on this baseline.
- The final focused command, `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js`, passed 8/8 after adding a focus-visibility assertion for **Continue exploring** without scrolling the page.
- `npm run build` passed with Vite 8.3.5 (59 modules). Code Reviewer found no actionable issues.
- No app behavior or styling changed. The full test suite was not run; the user-deferred human-playtest/content-expansion gate remains open.

## Boundaries

- Preserve the ending copy, completion calculations, focus containment, save format, reduced-motion behavior, and continue action.
- Keep desktop layout and unrelated compact panels unchanged.
- Do not add or expand authored game content.
- The independent two-chapter human playtest and content-expansion gate remain open; this polish check does not satisfy that gate.

## Verification plan

- Focused Playwright coverage is in `e2e/lab/full-restoration-ending.spec.js` for both viewport sizes at 125% text scale.
- The existing completion flow establishes the ending and covers narrative/status/statistic scrolling, keyboard focus visibility, and horizontal bounds.
- The complete focused ending spec passed 8/8 and `npm run build` passed with Vite 8.3.5 (59 modules). Code Reviewer found no actionable issues.
- The full test suite was not run, per `AGENTS.md`.

## Acceptance criteria

- At 320×480 and 390×480 with 125% text scale, the ending opens without horizontal page or dialog overflow.
- The narrative, status, and all six statistic values can be brought into view by scrolling.
- Keyboard focus reaches **Continue exploring** and keeps the focused action visible.
- All text and action controls remain within their containers without horizontal clipping.
- The complete focused ending spec and production build pass; no CSS correction was needed; the human-playtest/content gate stays active.
