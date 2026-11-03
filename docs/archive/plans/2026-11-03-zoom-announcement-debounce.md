# Plan: Debounce Zoom Announcements

## Goal

Keep the toolbar's visible zoom percentage while making its screen-reader
announcement useful and quiet. Remove `aria-live` from the changing visual
readout and announce a percentage through a separate polite status only after
the initial camera state has been established and a zoom change has settled.

Wheel input bursts should coalesce into one announcement of the final
percentage. Pan-only camera changes remain silent. Toolbar zoom and touch
pinch zoom announce their settled percentage, not each intermediate update.

## Constraints

- Keep the visible `.zoom-readout` percentage and its current visual behavior;
  remove its live-region behavior.
- Add a separate screen-reader-only polite status for settled zoom changes.
- Do not announce the initial percentage on mount.
- Do not announce pan-only movement, including the one-finger continuation
  after a pinch ends.
- Debounce repeated wheel updates so one wheel burst announces only its final
  percentage after zoom settles.
- Toolbar and pinch zoom announce the final settled percentage once per zoom
  action/gesture.
- Suppress any pending scale announcement while pinch is active. Expose a
  transient `pinchActive` signal from the viewport controller: set it when the
  pinch begins and clear it when a finger lifts into continuation pan, or when
  the pinch is cancelled or an external camera reset cancels it. Do not
  announce intermediate pinch scales, even when the gesture pauses longer
  than the wheel debounce interval; announce the final displayed percentage
  once after pinch ends.
- Track the last announced percentage so a cancelled/rolled-back zoom does not
  repeat an announcement for the prior percentage.
- Preserve camera geometry and controls, autosave/persistence behavior,
  renderer thresholds and rendering behavior, content, and save schema. Add no
  saved fields.
- Do not run the full test suite without user approval.

## Affected files

- `src/ui/WorldViewport.jsx`: retain the visible readout, remove its
  `aria-live`, and render a separate polite, screen-reader-only zoom status.
  Observe settled camera scale changes, cancel pending announcements while
  pinch is active, and avoid repeating the last announced percentage after a
  rollback.
- `src/ui/useWorldViewportController.js`: expose transient `pinchActive`
  state at pinch start and clear it on pinch end, continuation-pan transition,
  cancellation, or external camera reset; preserve camera behavior.
- New `e2e/lab/zoom-announcements.spec.js`: verify initial silence,
  settled zoom announcements, and pan silence.
- Existing `e2e/lab/research-chapter.spec.js` and
  `e2e/lab/touch-navigation.spec.js` will be run to protect toolbar zoom,
  pinch, and navigation behavior.

## Verification scope

- The new focused E2E verifies that the visible readout updates without live
  semantics; mount is silent; repeated wheel input produces one final
  percentage announcement; toolbar and pinch zoom announce only their settled
  percentage; pan-only movement produces no zoom announcement; and a long
  pause during an active pinch does not announce until release, with continued
  one-finger pan remaining silent. Verify zoom rollback/cancellation does not
  repeat the last announced percentage.
- Run the existing zoom/navigation E2E coverage in
  `e2e/lab/research-chapter.spec.js` and
  `e2e/lab/touch-navigation.spec.js` to confirm camera framing, pinch
  navigation, and persistence remain unchanged.
- Run `npm run build` and request code review after implementation.
- Do not run the full test suite without user approval.

## Test plan

The Test Engineer added eight focused cases in
`e2e/lab/zoom-announcements.spec.js`:

1. The visible percentage readout is not a live region.
2. The polite status remains empty on initial mount.
3. A rapid wheel burst produces one announcement with its final settled
   percentage.
4. Pan-only camera movement remains silent.
5. Toolbar zoom produces one settled percentage announcement.
6. Pinch zoom produces one settled percentage announcement, while the
   one-finger pan that continues after the pinch stays silent.
7. A staged pinch first changes the visible scale, pauses for more than 220 ms
   with both fingers down without announcing, changes scale again, then
   announces exactly once after one finger lifts; the continued pan stays
   silent.
8. Cancelling a pinch back to the last announced zoom restores the visible
   percentage without repeating that announcement.

Focused command:

~~~sh
npx playwright test e2e/lab/zoom-announcements.spec.js --workers=1
npx playwright test e2e/lab/zoom-announcements.spec.js --workers=1 --grep "a staged pinch waits for release to announce its final scale and continuation pan stays silent"
npx playwright test e2e/lab/zoom-announcements.spec.js --workers=1 --grep "cancelling a pinch back to the last announced zoom does not repeat that percentage"
npx playwright test e2e/lab/research-chapter.spec.js e2e/lab/touch-navigation.spec.js --workers=1
npm run build
~~~

The initial six-case E2E red baseline was 6 failed, as expected. The visible
readout still had `aria-live="polite"`, and the expected `zoom-announcer`
status node was absent. Wheel and toolbar zoom updated the visible percentage
but produced no status mutations. The pan case changed the scene transform and
remained silent, but could not find the expected status node. Pinch zoom
updated the readout without a status mutation; its one-finger continuation pan
assertion already passed. The strengthened staged-pinch case uses a large
pinch-out and confirms
the visible readout changes before waiting over 220 ms with both fingers down.
Its focused red command is:

~~~sh
npx playwright test e2e/lab/zoom-announcements.spec.js --workers=1 --grep "a staged pinch waits for release to announce its final scale and continuation pan stays silent"
~~~

The case fails at the active-pinch silence assertion: after the pause, it
records an intermediate `23%` announcement while both fingers remain down.
This confirms the reviewer-reported debounce defect. It then changes scale
again, releases one finger, and checks for one final settled announcement and
silence during continuation pan. The cancellation/rollback case passed 1/1 in
3.7 seconds: it announces a toolbar zoom, pinches out until the readout
changes, presses Escape to restore the prior percentage, waits 300 ms, and
confirms no repeated announcement. The initial sandbox launch returned
`spawn EPERM`; the focused command passed its launch barrier on retry with
process access. The Test Engineer's focused
`git diff --check -- e2e/lab/zoom-announcements.spec.js` was clean.

## Final verification (2026-11-03)

- `npx playwright test e2e/lab/zoom-announcements.spec.js --workers=1` passed
  8/8. The existing research-chapter and touch-navigation E2E passed 14/14.
- The Vite 8.3.5 production build passed. Reviewer re-review found no
  actionable findings, and the scoped diff-check was clean.
- The staged-pinch red baseline recorded an intermediate `23%` announcement
  after a >220 ms pause with both fingers down; the final pinch lifecycle
  coverage passes. The Escape rollback check passed 1/1 and confirms it does
  not repeat the last announced percentage.
- The full test suite was not run.
