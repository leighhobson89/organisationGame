# Cursor-anchored mouse-wheel zoom

**Status:** Complete. A focused browser regression confirms that a real off-center wheel event keeps the world point under the cursor anchored. Existing source passed; no app behavior changed.

## Goal

Protect the original navigation requirement that mouse-wheel zoom stays centered on the cursor. Verify the actual browser event path, coordinate conversion, and camera update together.

## Scope

- Add one focused Playwright regression in `e2e/lab/zoom-announcements.spec.js` using the existing fresh-lab setup and scene-camera reader.
- Use a 1280 by 720 viewport and find unobstructed empty space in the world viewport.
- Require the pointer point to be at least 100 CSS pixels from the viewport center and outside cards, drop zones, and controls.
- Read the viewport rectangle and camera before zoom. Convert the pointer from page coordinates to viewport-local coordinates, then derive the world point under it with `(local - pan) / scale` on each axis.
- Send a real `page.mouse.wheel(0, -120)` at the selected point and confirm the camera scale changes.
- Map the same world point through the post-wheel camera and assert it remains within 1 CSS pixel of the original local pointer on both axes.

## Boundaries

- If the browser regression exposes a defect, limit source changes to pointer coordinate conversion and wheel handling in `src/ui/useWorldViewportController.js`.
- Preserve the `zoomAtPointer` camera math, toolbar zoom, pinch behavior, and save fields.
- Do not add game content or alter unrelated navigation behavior.
- The independent human playtest and content-expansion gate remain open; this regression does not satisfy that gate.

## Test plan and baseline

- Set the browser viewport to 1280 by 720 and load a fresh laboratory.
- Find an unobstructed point in the world viewport, assert it is at least 100 CSS pixels from the viewport center, and avoid cards, drop zones, and controls.
- Read the viewport rectangle and pre-wheel scene camera. Convert the page pointer to viewport-local coordinates and compute the world point beneath it as `(localX - panX) / scale` and `(localY - panY) / scale`.
- Move the real mouse to the point and send `page.mouse.wheel(0, -120)`. Poll until the scene scale changes, then map the same world point through the post-wheel camera.
- Assert each mapped coordinate is within 1 CSS pixel of the original local pointer. This distinguishes cursor anchoring from viewport-center zoom and catches page-coordinate use.
- The focused command `npm run test:e2e -- --workers=1 e2e/lab/zoom-announcements.spec.js` passed 9/9, including the new actual-wheel case. No source fix was indicated by this baseline.
- `npm run build` passed with Vite 8.3.5 (59 modules). Code Reviewer found no actionable findings. No app behavior changed; the full suite was not run and the deferred human-playtest/content-expansion gate remains open.

## Verification

- Run `npm run test:e2e -- --workers=1 e2e/lab/zoom-announcements.spec.js`.
- `npm run build` passed with Vite 8.3.5 (59 modules), and scoped code review found no actionable findings.
- Do not run the full test suite without user approval, per `AGENTS.md`.

## Acceptance criteria

- A real wheel event at an empty point well away from the viewport center changes the scale.
- The world point originally under the pointer remains within 1 CSS pixel of that pointer on both axes.
- The focused browser spec passed 9/9 and the production build passed; review found no actionable issues.
- The separate human-playtest/content-expansion gate stays open.
