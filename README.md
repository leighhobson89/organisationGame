# The Palimpsest Laboratory

**Status: two playable research chapters and the current-content restoration ending; full game in progress.** A fresh laboratory contains exactly 174 entities: the original 150 canonical items and 24 authored records across three new collections. See the [current playable slice](docs/VERTICAL_SLICE.md).

The ending is derived from correct filing of all 174 catalogued items, completion of every collection, and solution of every catalogued puzzle. It presents an accessible Palimpsest Engine replay, completion statistics, and a way to continue exploring without changing the save schema. The strongest reading of the Unsent Apology is that the Professor chose to follow the first stable impression by ordering an eastward survey toward the sealed bell chamber. Later records place that investigation before the bell and name the Professor and Elian as witnesses, but do not establish that his choice caused the Chaos Event. The Engine preserved an impression as a witness, not a cause; the Event's original trigger and Elian's response remain unresolved.

First-session usability updates preserve the existing content and saves while reducing fresh-layout overlaps from 259 pairs to 1 with no fully occluded items. The Inspector's **Move item** action stays visible during detail scrolling at desktop and short mobile playtest sizes. These changes are automated-verified.

First-time players have a persistent **How to Play** guide and a visible first task. The opening Harmonic Calibration scraps now have distinct names and share a **Series: Harmonic Calibration** label that points to the matching Folio. Its slots fill automatically in any order; puzzle sequences are explained separately. **Save & Restore** includes a confirmed **Start Over** action that backs up the current progress and leaves manual save slots intact.

A 2026-11-05 agent-led fresh-Incognito spot check imported a normalized 174-item chronology-complete fixture through the visible Save & Restore UI. Manual reload preserved 3/3 research collections, 18%, Chronology Wheel, solved Chronology of the Last Bell, and the Notebook's **The Last Bell** entry. This was a prepared-state persistence check, not a chapter playthrough or independent human feedback; the original cumulative session's own post-chronology reload remains unverified. The independent human playthrough is still pending, so content expansion remains gated.

## Run locally

Use Node.js `^20.19.0 || >=22.12.0` and npm.

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
npm run test:e2e:production
~~~

The default Playwright E2E configuration starts the Vite development server. The opt-in `test:e2e:production` command builds the app, starts Vite Preview, and checks production module loading plus a saved filing across reload. See the [Testing Guide](docs/TESTING_GUIDE.md) for focused commands, runtime details, and output locations.

## Build and preview the production app

Use the checked-in lockfile to install the exact dependency versions, then build and serve the production output with Vite Preview:

~~~sh
npm ci
npm run build
npm run preview
~~~

Open the local URL printed by Vite Preview.

To run the production browser smoke check, use `npm run test:e2e:production`; it builds the app and starts Vite Preview automatically.

## Known limitations and open gates

- **Current scope:** this is the 174-entity, two-research-chapter slice and its restoration ending; the full game is still in progress. Focused software checks indicate it is ready for a local human test, while the independent fresh-save playthrough and content-expansion gate remain open. See the [Phase 1 human-testing readiness checklist](docs/PHASE_1_HUMAN_TESTING.md), the [active playtest gate](docs/plans/browser-scaling-playtest-gate.md), and the [playtest record](docs/playtests/2026-11-03-research-chapters.md).
- **Short-height tablet layout:** fresh-start guidance is focused-verified at 100% text scale for 721–1050px widths and 550px, 600px, and 719px heights. The large-text layout is also verified at 150%, 175%, and 200% across that range, with native disclosures for secondary progress and control guidance. Narrow compact screens and tablet heights of 720px or more retain their existing layouts.
- **Short-height medium-desktop large-text layout:** fresh-start guidance is focused-verified at 150%, 175%, and 200% text scales for 1051–1340px widths and 550px, 600px, and 719px heights. Keyboard access, selection feedback, camera/autosave preservation, responsive boundaries, and the existing Notebook, Atlas, and Finder layouts are covered. The independent human playthrough remains deferred, so content expansion stays gated.
- **Short-height wide-desktop large-text layout:** a fresh-start guidance bay and clear world controls are focused-verified at widths of 1341px or more, heights of 550px, 600px, and 719px, and stored text scales of 150%, 175%, and 200%. Flow styling applies only with no panel open; responsive boundaries, open Notebook/Atlas/Finder/Inspector layouts, keyboard access, selection feedback, and camera/autosave preservation are covered. The independent human playthrough remains deferred, so content expansion stays gated.
- **Story:** The strongest reading of the Unsent Apology is that the Professor chose to follow the first stable impression by ordering an eastward survey toward the sealed bell chamber. The records connect that investigation to the place and period of the later bell, but do not establish that his choice caused the Chaos Event. The Engine is a witness/recorder; the original trigger and Elian's response remain unresolved. See the [playable-slice notes](docs/VERTICAL_SLICE.md).
- **Audio:** sound effects are opt-in, and the recorded playthrough left them off. Human listening quality has not been assessed; the playtest record and [automated audio checks](docs/TESTING_GUIDE.md) cover different evidence.
- **Performance:** the hybrid Canvas full-world interaction result from 174 to 5,024 entities passes on one host; it is not a guarantee for other devices. A later render-threshold update moved the 5,024-item starting view to Canvas, with wheel p95 of 16.8/16.7/16.8 ms and no over-50 ms intervals across its three measured trials. This remains a one-host sample. See the [dense start-threshold report](docs/performance/2026-11-03-dense-start-render-threshold.md), the [hybrid Canvas report](docs/performance/2026-11-03-hybrid-canvas-overview.md), and the earlier [world-ground report](docs/performance/2026-11-03-world-ground-treatment.md).
- **Full test suites:** get user approval before running one, as required by [AGENTS.md](AGENTS.md); the [Testing Guide](docs/TESTING_GUIDE.md) lists focused verification commands.

