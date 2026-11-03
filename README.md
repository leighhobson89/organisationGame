# The Palimpsest Laboratory

**Status: two playable research chapters and the current-content restoration ending; full game in progress.** A fresh laboratory contains 174 entities: the original 150 canonical items and 24 authored records across three new collections. The hybrid Canvas overview meets the one-host full-world interaction gate from 174 to 5,024 entities; the separate human playthrough remains open, so content expansion stays gated.

The ending is derived from correct filing of all 174 catalogued items, completion of every collection, and solution of every catalogued puzzle. It presents an accessible Palimpsest Engine replay, completion statistics, and a way to continue exploring without changing the save schema. The recovered records still do not establish what triggered the Chaos Event or Elian's response.

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

The Playwright configuration starts the Vite server for E2E runs. See `docs/TESTING_GUIDE.md` for the full-suite approval requirement, runtime details, and output locations.

The opt-in `npm run test:perf` command runs the serial browser scaling benchmark. The clustered baseline, post-serialization distributed retest, frame-bounded camera/culling retest, and hybrid Canvas overview benchmark are documented separately under `docs/performance/`. The latest same-host interaction gate passes; keep content expansion gated until the separate two-chapter human playthrough is complete.

