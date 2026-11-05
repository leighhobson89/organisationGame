# Plan: Keep the Palimpsest Engine Legible at Overview Zoom

**Status:** Complete. The Engine now has a compact, scale-aware overview presentation. The independent human-playtest/content-expansion gate remains open.

## Goal and scope

Keep the Engine's name and current stage legible when the world is zoomed out, while preserving its existing world footprint and decorative mechanism. Restore the current full layout when zoomed in. The synopsis may be visually omitted in overview mode if it remains available to assistive technology.

Likely implementation files:

- `src/ui/WorldViewport.jsx` to pass the current camera scale to `InventionCore`.
- `src/ui/InventionCore.jsx` and `src/styles/app.css` for the overview presentation.
- `e2e/lab/research-chapter.spec.js` for focused scale and accessibility coverage.

Do not change progression, authored content, save data, camera behavior, the existing Engine footprint, or the human-playtest/content-expansion gate.

## Implementation decisions

- Use a single zoom threshold to select overview presentation; preserve the present presentation above it.
- In overview mode, give the Engine title and stage chip readable screen-space text without enlarging the whole Engine or allowing text to escape its existing world-space card.
- Hide redundant synopsis copy visually in overview mode while keeping its text in the accessibility tree.
- Preserve the Engine art, accessible name, reduced-motion behavior, and stage content.

## Acceptance criteria

- At 50% world zoom, the title and stage chip meet the agreed minimum screen-space text size and remain inside the card without overlapping the Engine art.
- The synopsis remains available to assistive technology in overview mode.
- At 100% zoom, the existing full layout and synopsis presentation remain unchanged.
- Camera zoom, Engine stage/progression, and save state are unchanged by this presentation-only behavior.
- The existing browser-scaling/playtest plan remains active and untouched.

## Verification plan

- The Test Engineer added focused regression coverage in `e2e/lab/research-chapter.spec.js` using normalized chronology fixtures at 50% and 100% zoom.
- At 50%, assert screen-space title/stage font thresholds; title/stage card bounds; no overlap between title, stage, Engine artwork, or card edges; synopsis layout height at most 1 CSS pixel; and synopsis available as the Engine's accessible description.
- At 100%, assert the full synopsis is visible, text remains within the card, and the chronology stage content is unchanged.
- Run the focused research-chapter E2E cases and a production build; do not run the full suite.
- Review the change for zoom-boundary regressions and reduced-motion or accessibility regressions.

Focused command: `npx playwright test e2e/lab/research-chapter.spec.js --grep "Engine overview|Engine restores its complete descriptive layout" --reporter=line --workers=1`.

Red baseline: the initial run failed both tests on the missing accessible description. After assertion order was refined, the second red run stopped at the 50% title-size assertion (8px), before the stage or synopsis assertions ran. The 5.44px stage size is a baseline CSS calculation; the visible synopsis was observed in the pre-change screenshot. The 100% matcher initially failed on curly-apostrophe punctuation, which the Test Engineer fixed.

## Results

- Red baseline: the initial pre-implementation run failed both checks because the Engine had no accessible description. After assertion order was refined, the second red run stopped at the 50% title-size assertion (8px) and did not reach the stage or synopsis assertions. The stage's 5.44px baseline is a CSS calculation, and synopsis visibility came from the pre-change screenshot. The 100% matcher exposed curly-apostrophe brittleness; the Test Engineer fixed the matcher.
- The focused command `npx playwright test e2e/lab/research-chapter.spec.js --grep "Engine overview|Engine restores its complete descriptive layout" --reporter=line --workers=1` passed 2/2. The complete research-chapter spec passed 10/10.
- The Vite build passed with 61 modules after the sandbox returned `spawn EPERM` and the process-access retry passed.
- Scoped `git diff --check` exited 0 with only LF-to-CRLF notices. Code Reviewer found no actionable issues. No full suite was run.
- Updated `docs/ARCHITECTURE.md`, `docs/TESTING_GUIDE.md`, and `docs/ROADMAP.md`. The independent human-playtest/content-expansion gate remains open.
