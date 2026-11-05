# Plan: Phase 1 Human-Testing Readiness

**Status:** Finalized. The Phase 1 human-testing readiness and exit checklist is documented. Recorded focused automated checks show no known software blocker to beginning the test; the independent human playthrough remains outstanding and the existing playtest/content-expansion gate remains open.

## Goal

Document whether the current playable slice is ready to hand to a human tester, the exact work needed to run that test, and the evidence required to close the human-playtest gate. Keep “ready to test” separate from “human test complete” and from “full game complete.”

The pre-existing documentation has no separately named Phase 1 acceptance specification. The playable slice in `docs/VERTICAL_SLICE.md` includes the first two research chapters and the current 174-item full-restoration ending, while the active `docs/plans/browser-scaling-playtest-gate.md` requires an independent fresh-save playthrough of both research chapters before the content-scale decision changes and does not require reaching the ending. This handoff maps Phase 1 human testing to that existing two-chapter gate; include the ending only if the project owner expands the scope.

## Current evidence and readiness

- The focused release-readiness plan recorded a passing Vite build, focused unit and browser checks for startup, core progression, accessibility, persistence/recovery, responsive layouts, and the 174/5,024-item structural interaction regression. It found no release-blocking application defect. No full suite was run.
- The configured production smoke could not start on port 5183 because the port was reported occupied. The equivalent isolated production-preview smoke passed on port 5184 using a temporary config, which was removed afterward. Repository production configuration was unchanged.
- `npm run dev` binds Vite to `127.0.0.1`; therefore readiness covers a human tester on the development machine. Remote or separate-device testing needs reachable hosting/network setup and a smoke check against that setup.
- The existing exploratory browser record is agent-led, not independent human feedback. It completed both chapter loops cumulatively, but the manual post-chronology reload in that session was not verified; a separate focused E2E verifies chronology save/reload.
- The ending and broader game are not the same milestone as the two-chapter human gate. Human listening quality for optional audio is also unassessed and should be tracked separately unless Phase 1 explicitly includes audio acceptance.

**Readiness decision:** Based on recorded evidence, no code change or additional automated full-suite run is a known prerequisite to start a focused human test of the two research chapters. Operationally, a tester still needs a fresh save, a supported local runtime, and a facilitator/recorder. This is a readiness assessment, not evidence that the test has been conducted or that Phase 1 is complete.

## Work to start and complete the human test

1. Use the existing two-chapter fresh-save gate as this Phase 1 human-test scope. If the project owner wants the 174-item ending or subjective optional-audio review included, explicitly expand the scope before scheduling; neither is required by the existing gate.
2. Prepare a fresh browser profile/save and run the app through Vite using the documented supported Node version. Do not reuse a chronology-complete prepared fixture as the playthrough.
3. Conduct the manual journey in `docs/plans/browser-scaling-playtest-gate.md`: organize and solve the first research chapter, use the Resonance Lens, complete the three second-chapter collections, try the Missing Member Compass, solve Chronology of the Last Bell, and inspect the Notebook and Chronology Wheel.
4. Include pointer and keyboard movement, world pan/zoom, and a save/reload after chronology completion. Confirm the corrected Inspector **Move item** visibility and the reduced overlap in the fresh layout.
5. Record tester independence, date, browser/OS, viewport, input devices, text scale, steps completed, save/reload result, confusion or friction, clipping/accessibility/audio observations, defects, and follow-up actions in `docs/playtests/2026-11-03-research-chapters.md`. Mark any incomplete step instead of inferring success.
6. Triage findings. If a reproducible release-blocking defect appears, create a separate implementation plan, fix it, and run only the focused checks for that defect. Otherwise retain the evidence and decision in the playtest record and roadmap.

## Human-playtest exit criteria

- An independent human completes both research chapter loops from a fresh save. Any blocked or incomplete step is recorded with its reason; it does not close the gate unless the scope is formally revised.
- Pointer and keyboard movement, pan/zoom, puzzle progression, the post-chronology save/reload, the Notebook entry, and Chronology Wheel state are observed and recorded.
- The corrected Inspector visibility and fresh-layout overlap behavior are checked in the tester's environment.
- Observations and actionable issues are recorded in the existing playtest record with environment details and follow-up owners/actions.
- The team reviews the evidence and explicitly records the content-scale decision. Automated results and agent-led exploration are not substituted for independent feedback.

The current content ending is an optional extension to these criteria unless the Phase 1 scope decision above says otherwise. Human audio-quality review remains a separate open item unless sound is included in the Phase 1 test scope; automated PCM bounds do not establish listening quality.

## Documentation implementation scope

- Add the durable Phase 1 human-testing readiness and exit checklist at `docs/PHASE_1_HUMAN_TESTING.md`.
- Link it from the README and Roadmap and summarize the current readiness state in the Testing Guide.
- Preserve the active browser-scaling/playtest plan and existing user edits. Do not change application behavior or claim the human gate is closed.
- Archive this finalized plan under `docs/archive/plans/` and leave `docs/plans/` with only the pre-existing active browser-scaling/playtest gate.

## Focused verification

- Test-specialist baseline: the focused documentation contract test failed 0/2 before the documentation implementation, as expected. The two missing contracts were the readiness guide and the README/Roadmap links to it.
- After the documentation implementation, the focused contract test passed 2/2. It verifies the README/Roadmap links and that the guide separates automated readiness from the open human-test gate.
- Reviewed the scope mapping against the existing vertical-slice and browser-scaling/playtest documents: no separately named Phase 1 acceptance spec existed, so the checklist maps Phase 1 human testing to the existing independent, fresh-save, two-chapter gate. The 174-item ending and subjective audio review remain separate unless scope is expanded.
- Reviewed the guide's verification, playtest, and reload statements against the recorded release-readiness results and playtest record. The production-preview port-5183 startup issue and equivalent port-5184 pass are represented accurately. The `127.0.0.1` bind limits readiness to a tester on the development machine; remote/separate-device testing requires reachable hosting and a smoke check. No human test is claimed complete.
- `git diff --check` passed; only line-ending conversion notices were emitted. No full unit/E2E suite was run and no application code changed.
- Archived this finalized plan at `docs/archive/plans/2026-11-05-phase-1-human-testing-readiness.md`; the pre-existing `browser-scaling-playtest-gate.md` remains active in `docs/plans/`.
- Do not run the full unit or E2E suite; `AGENTS.md` requires user approval for a full suite.

