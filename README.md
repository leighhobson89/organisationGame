# The Palimpsest Laboratory

**Status: two playable research chapters and the current-content restoration ending; full game in progress.** A fresh laboratory contains exactly 174 entities: the original 150 canonical items and 24 authored records across three new collections. See the [current playable slice](docs/VERTICAL_SLICE.md).

The ending is derived from correct filing of all 174 catalogued items, completion of every collection, and solution of every catalogued puzzle. It presents an accessible Palimpsest Engine replay, completion statistics, and a way to continue exploring without changing the save schema. Existing clues support the Professor's choice to preserve the recording; they do not establish what triggered the Chaos Event or Elian's response.

First-session usability updates preserve the existing content and saves while reducing fresh-layout overlaps from 259 pairs to 1 with no fully occluded items. The Inspector's **Move item** action stays visible during detail scrolling at desktop and short mobile playtest sizes. These changes are automated-verified; the independent two-chapter human playthrough is still pending, so content expansion remains gated.

## Run locally

Use Node.js 20.19+ (or 22.12+) and npm.

~~~sh
npm install
npm run dev
~~~

Open the Vite URL printed in the terminal, normally <http://127.0.0.1:5173/>.

Run the project through Vite. Do not open `index.html` with a static server or VS Code Live Server: Vite transforms the app's `.jsx` modules for the browser. A static server may serve them with the `text/jsx` MIME type, which browsers do not execute as JavaScript.

If the app's entry module fails to load, the page displays an accessible recovery message with these Vite startup steps.

## Build and focused checks

~~~sh
npm run build
npm run test:game
npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js e2e/lab/organising-loop.spec.js
~~~

The Playwright configuration starts the Vite server for E2E runs. See the [Testing Guide](docs/TESTING_GUIDE.md) for focused commands, runtime details, and output locations.

## Build and preview the production app

Use the checked-in lockfile to install the exact dependency versions, then build and serve the production output with Vite Preview:

~~~sh
npm ci
npm run build
npm run preview
~~~

Open the local URL printed by Vite Preview.

## Known limitations and open gates

- **Current scope:** this is the 174-entity, two-research-chapter slice and its restoration ending; the full game is still in progress. The recorded browser journey is agent-led, not independent human feedback. An independent fresh-save playthrough was deferred, so [content expansion remains gated](docs/plans/browser-scaling-playtest-gate.md). The [playtest record](docs/playtests/2026-11-03-research-chapters.md) documents what was and was not completed.
- **Story:** the Professor's choice to preserve the recording is supported by existing clues. The event's original trigger and Elian's response remain unresolved; see the [playable-slice notes](docs/VERTICAL_SLICE.md).
- **Audio:** sound effects are opt-in, and the recorded playthrough left them off. Human listening quality has not been assessed; the playtest record and [automated audio checks](docs/TESTING_GUIDE.md) cover different evidence.
- **Performance:** the hybrid Canvas full-world interaction result from 174 to 5,024 entities passes on one host; it is not a guarantee for other devices. A later render-threshold update moved the 5,024-item starting view to Canvas, with wheel p95 of 16.8/16.7/16.8 ms and no over-50 ms intervals across its three measured trials. This remains a one-host sample. See the [dense start-threshold report](docs/performance/2026-11-03-dense-start-render-threshold.md), the [hybrid Canvas report](docs/performance/2026-11-03-hybrid-canvas-overview.md), and the earlier [world-ground report](docs/performance/2026-11-03-world-ground-treatment.md).
- **Full test suites:** get user approval before running one, as required by [AGENTS.md](AGENTS.md); the [Testing Guide](docs/TESTING_GUIDE.md) lists focused verification commands.

