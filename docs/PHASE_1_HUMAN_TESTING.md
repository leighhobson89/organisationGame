# Phase 1 Human Testing Readiness

**Readiness: READY TO BEGIN HUMAN TESTING LOCALLY ON THE DEVELOPMENT MACHINE. Human-test status: OPEN.** The 2026-11-05 onboarding/clarity update also passed focused browser checks and a production build. No independent human playthrough has been completed, so Phase 1 is ready to test but not complete; the playtest and content-expansion gate remains open.

## Phase 1 scope for this handoff

The project describes the playable slice as the first two research chapters and the current 174-item restoration ending. The pre-existing documentation does not define a separately named Phase 1 acceptance specification. For this handoff, Phase 1 human testing maps to the existing, narrower human-playtest gate: an independent fresh-save playthrough of both research chapters. That gate explicitly keeps the complete story and ending outside the milestone. Reaching the restoration ending and reviewing optional audio are separate extensions unless the project owner changes that scope.

## Readiness evidence

- The focused release-readiness verification recorded a passing production build and focused checks for core game rules, production loading, both chapter journeys, accessibility and responsive layouts, save/recovery, and the 174/5,024-item structural interaction regression. No release-blocking application defect was found. The full unit and E2E suites were not run.
- The configured production-preview smoke could not start on port 5183. The equivalent isolated smoke passed on port 5184 with a temporary configuration that was removed. This is a port-specific check limitation; the documented Vite development workflow remains available for the human session.
- The `npm run dev` script binds Vite to `127.0.0.1`. The readiness decision therefore covers a human tester using the development machine; remote or separate-device testing needs reachable hosting/network setup and a smoke check against that setup before testing.
- Existing browser playthrough evidence is agent-led. A focused E2E verifies chronology save/reload, but the manual reload in the exploratory browser session was not completed. Neither automated checks nor agent-led exploration count as independent human feedback.
- Previously observed fresh-layout overlap and Inspector action visibility issues have focused automated coverage. The human tester should still report whether those surfaces work clearly in their environment.
- A persistent **How to Play** guide, first-task direction, distinct Harmonic Calibration titles, series labels, explicit auto-fill/any-order container wording, and confirmed **Start Over** action are implemented and focused-verified. The guide provides an actionable first step to the **Carrier Tone Plate** and **Harmonic Calibration Folio**.
- **Start Over** backs up the current laboratory before replacing the autosave; it preserves all three manual save slots. Focused browser cases cover cancellation, successful reset, backup and autosave write failures, and legacy calibration-title normalization without losing placement or progress.
- Focused verification after these changes: onboarding/first-action browser checks passed 7/7, related Inspector layout checks passed 3/3, header responsive checks passed 23/23, and the production build passed with Vite 8.3.5 (63 modules). The full suites were not run.

## Outstanding work

### Outstanding before Phase 1 can be marked complete

1. Identify an independent human tester. A developer or coding agent can facilitate and record the session, but cannot count as the independent participant.
2. Start from a fresh browser profile and a fresh save; do not import a prepared chronology-complete fixture. If the profile already has a save, use **Save & Restore -> Start Over** and confirm before the test begins.
3. Run the app with the documented Node.js version and Vite workflow (`npm ci`, then `npm run dev`). Confirm the app loads and record the browser, operating system, viewport, input devices, and text scale.

### During the session

1. Open the header's **How to Play** action (shown as **Help** on compact screens) and follow **Find the first tuning plate**, or use the visible first-action hint. Confirm the item name, **Series: Harmonic Calibration**, clue, and Folio label make the match understandable. File calibration items in any order and note that slots fill automatically; then solve the pulse puzzle separately.
2. Complete the first research chapter: organize Harmonic Calibration, solve its puzzle, and use the Resonance Lens.
3. Complete the three second-chapter collections, try the Missing Member Compass, solve Chronology of the Last Bell, and inspect the Notebook and Chronology Wheel.
4. Use both pointer and keyboard movement; pan and zoom the world; save and reload after chronology completion. Check that **Start Over** is discoverable and its confirmation explains the backup; cancel it to verify the session continues. Confirm it only if a fresh session is desired.
5. Check the fresh-start layout and Inspector **Move item** action. Record confusion, friction, clipping, inaccessible controls, unexpected behavior, and any step the tester cannot complete. Do not infer success for skipped steps.
6. If audio is in the agreed scope, enable the optional sound effects and record listening-quality feedback. Automated audio rendering checks do not establish subjective quality.

### After the session

1. Add the session date, independence, environment, steps completed, save/reload result, observations, and follow-up actions to [the existing research-chapter playtest record](playtests/2026-11-03-research-chapters.md).
2. Triage any reproducible release-blocking findings through a separate implementation plan and focused verification. Record lower-severity usability findings and owners as follow-ups.
3. Review the evidence and explicitly record whether the content-scale decision changes. Keep the human gate open until the exit criteria below are met.

## Human-test exit criteria

- An independent human completes both research chapter loops from a fresh save. Any blocked or incomplete step is recorded with its reason; it does not close the gate unless the scope is formally revised.
- The record covers pointer and keyboard movement, pan/zoom, puzzle progression, post-chronology save/reload, the Notebook entry, and Chronology Wheel state.
- The tester checks the fresh-start layout and Inspector action in their environment and records any friction or clipping.
- The tester records whether the guide, first task, filing explanation, and Start Over confirmation remove or leave any confusion from the initial playtest.
- The playtest record contains the environment, completed steps, observations, issues, and follow-up actions.
- The team reviews the result and records a content-scale decision. Agent-led exploration and automated tests do not substitute for this feedback.

The full-restoration ending is outside the current human-playtest gate. Include it only if Phase 1 is deliberately expanded to require completion of all 174 items. Human audio-quality review is also separate unless optional audio is added to the agreed test scope. The overall game remains in progress after this focused playtest.

## Current project status

| Checkpoint | Status |
| --- | --- |
| Focused software evidence for starting a human test | Ready based on recorded checks |
| Independent two-chapter human playthrough | Outstanding |
| Human-playtest/content-expansion gate | Open |
| Full game completion | In progress |
