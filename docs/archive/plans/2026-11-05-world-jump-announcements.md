# Plan: Announce Successful World Jump Navigation

## Problem

`WorldViewport` includes a polite `world-announcer`, but it is empty. The World Jump selector recenters the camera and resets to its neutral option without announcing where the view moved. Screen-reader users therefore cannot confirm the result, including which unfinished item a collection jump targeted.

## Scope and implementation

- Populate the existing polite `world-announcer` after a successful World Jump route.
- Announce the resolved target for Starting area, Engine, destinations, and scratch pads.
- For a collection route, announce the collection and the first unfinished item targeted by the jump.
- Ensure choosing the same route again produces a fresh announcement after the live region has reset.
- Keep ordinary camera panning, zooming, and other camera gestures silent in this status.
- Preserve camera navigation, selector reset, focus, game state, and save behavior.

## Acceptance criteria

- Each supported World Jump route announces its successful target in the polite live region.
- Collection announcements identify both the collection and its first unfinished item.
- Repeating a previously selected route after panning away produces a new announcement even when the text is identical.
- Ordinary arrow-key panning does not create or replace a World Jump announcement.
- Missing or unresolved route targets do not announce a successful jump.
- Camera behavior, neutral selector reset, item selection, progression, and save data remain unchanged.

## Focused verification

- `npx playwright test e2e/lab/world-jump-announcements.spec.js --workers=1 --reporter=line` passed 4/4 for Starting area/Engine, destination/scratch pad, collection/first unfinished item, and repeated destination/silent-pan cases.
- Red baseline: all four tests failed because `world-announcer` remained empty. In the repeated-route case, the first announcement assertion failed before later mutation-count checks. The initial sandbox worker spawn returned `EPERM`; the process-access rerun confirmed the 4/4 red baseline.
- `world-jump-repeat.spec.js` plus `unfinished-collection-navigation.spec.js` passed 4/4. Compact-start framing's `jumping back to the start` case passed 3/3.
- Vite 8.3.5 build passed with 62 modules; scoped reviewer found no actionable findings. The full suite was not run.
- `docs/ARCHITECTURE.md`, `docs/TESTING_GUIDE.md`, and `docs/ROADMAP.md` record the behavior and verification results.

## Status

Complete. Focused E2E coverage, build, documentation update, and scoped review are complete. Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-world-jump-announcements.md`.
