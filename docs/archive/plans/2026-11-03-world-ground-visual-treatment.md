# Plan: Steampunk World-Ground Treatment

**Status:** Complete and reviewed on 2026-11-03. The focused CSS treatment,
regression coverage, performance-harness alignment, documentation, and review
are complete. The independent playtest/content-expansion gate remains active.

## Goal

Give the existing laboratory work surface a restrained, steampunk survey-floor
identity. The live 1440 × 900 view showed styled objects and interface chrome
over a mostly flat brown world backdrop.

## Scope and constraints

- Style the existing `.world-ground` element in `src/styles/app.css` with static
  low-contrast panel seams and concentric survey rings centered on the Engine
  hub at world coordinates (2,600, 1,700).
- Keep the marks subtle at normal and overview zoom, behind the Canvas,
  destinations, and items, and moving with the world camera.
- Preserve the existing `aria-hidden` and `pointer-events: none` behavior.
- Add no nodes, assets, catalog/story content, save fields, or gameplay rules.
- Keep `docs/plans/browser-scaling-playtest-gate.md` active. This visual polish
  does not count as the independent human playthrough or unblock content
  expansion.

## Implementation and verification

1. Add the floor treatment to the existing `.world-ground` CSS rule only.
2. Add one focused browser regression for the background layers, hidden and
   non-interactive semantics, and layer ordering; capture normal and overview
   screenshots for visual review.
3. Align the test-only sparse-view expectations in
   `performance/browser-scaling-regression.spec.js` and
   `performance/browser-scaling-benchmark.spec.js` with the documented range:
   allow 8–10 mounted objects while requiring all eight calibration IDs. The
   Architect confirmed `field-note-032` is correctly included by the 5,024-item
   camera query; preserve that result and make no runtime camera or culling
   changes.
4. Run the focused visual regression, existing pan/drop coverage, production
   build, and the opt-in 174/5,024-item scaling check. Confirm no entity count
   or interaction behavior changes and no repeatable interaction interval over
   50 ms.
5. Request focused CSS/performance code review.
6. Update the testing guide, architecture, vertical-slice notes, and roadmap;
   archive this plan after review and verification while preserving the active
   human-playtest gate.

## Test plan

Focused regression: `e2e/lab/world-ground-appearance.spec.js` checks that the
world-sized ground stays hidden from assistive technology and has
`pointer-events: none`; computed CSS contains broad repeating panel seams and
radial survey rings; the Canvas, destinations, and interactive items remain
above it and keep their pointer behavior; pan and zoom move/scale the treatment
with the world; and the visible object count remains 174.

Focused command:

```sh
npm run test:e2e -- --workers=1 e2e/lab/world-ground-appearance.spec.js
```

Red baseline: the focused test failed at the expected missing
`repeating-linear-gradient` panel-seam assertion because `.world-ground` had no
background treatment yet. The final focused test passed after the CSS change.

The scaling harness also needs a test-only alignment before verification. In
both `performance/browser-scaling-regression.spec.js` and
`performance/browser-scaling-benchmark.spec.js`, accept 8–10 mounted objects in
the populated sparse view while requiring all eight calibration IDs. The
Architect confirmed that the 5,024-item camera query correctly includes
`field-note-032`; retain that camera-query behavior and do not change runtime
culling. This preserves the documented tolerance for nearby mounted objects
without weakening the requirement that every calibration card is present.

Run the existing interaction and build checks:

```sh
npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "physical dragging files an item to a destination|keyboard panning and zoom controls visibly update the laboratory view"
npm run build
npm run test:e2e:performance -- --workers=1
npm run test:perf
```

The opt-in structural regression and serial Edge timing benchmark are separate
checks; report their results separately. The independent two-chapter human
playthrough and content-expansion gate remain open; this visual change and
harness alignment do not satisfy them.

## Results

- Floor appearance E2E: 1/1 passed; organizing-loop E2E: 9/9 passed.
- Opt-in performance E2E: 12/12 passed; serial Edge benchmark and build: 1/1
  in 1.9 minutes; production build passed with Vite 8.3.5.
- Engine-centered and overview screenshots were visually reviewed. Code
  Reviewer found no actionable issues. The full test suite was not run.
- Full-world interactions met the same-host gate through 5,024 entities. At
  the dense 5,024-item starting view, wheel p95 was 50.1 ms and 2/3 trials had
  intervals over 50 ms; no long tasks over 50 ms were recorded. See
  `docs/performance/2026-11-03-world-ground-treatment.md` for the table and
  methodology.
- `docs/plans/browser-scaling-playtest-gate.md` remains the active plan.
