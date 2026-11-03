# Plan: README Build, Preview, and Release-State Guidance

**Status:** Complete. This README-only documentation change improves the reproducibility of local production builds and makes the project's current release state and open gates easy to find; it does not certify release readiness.

## Goal and boundary

Update `README.md` so a contributor can install the locked dependencies, create a production build, and serve that build locally. Present the current game scope and remaining release limitations concisely, with links to the existing evidence. Keep the existing development-server instructions and established testing guidance accurate.

Do not change application code, tests, authored content, benchmark results, or gate decisions. Do not describe the game as release-ready, claim cross-device performance, or imply that automated evidence replaces the deferred independent human playthrough. Content expansion remains gated by the active browser-scaling and two-chapter playtest plan.

## Implementation plan

1. Review the existing README sections and retain the supported Node.js versions (20.19+ or 22.12+).
2. Add reproducible production instructions using `npm ci`, `npm run build`, and `npm run preview`; tell readers to open the local URL printed by Vite Preview.
3. Add a short, scannable current-state and known-limitations section that identifies the current 174-item/two-research-chapter slice and the full-game-in-progress status.
4. Clearly summarize open evidence and gates: independent human playthrough deferred; content expansion gated; Chaos Event trigger and Elian's response unresolved by current clues; audio quality awaits human listening feedback; performance evidence is from one host and includes recorded dense-view intervals over the interaction threshold; full-suite execution requires user approval under `AGENTS.md`.
5. Link the statements to the active playtest gate, the two-chapter playtest record, `docs/VERTICAL_SLICE.md` for authored-story status, the hybrid Canvas and dense-view performance reports, and `docs/TESTING_GUIDE.md`. Use relative paths that resolve from the repository root.

## Verification plan

- Inspect the final README diff to ensure it remains documentation-only, concise, and does not overstate release readiness.
- Confirm `package-lock.json` is checked in and the `build` and `preview` scripts exist in `package.json`; `npm ci` is the lockfile-based install command.
- Resolve every newly added relative documentation link from the repository root and confirm its target exists.
- Match each scope, story, audio, performance, and full-suite claim to its linked evidence before including it:
  - Current content count and chapter scope: `docs/VERTICAL_SLICE.md` and `docs/playtests/2026-11-03-research-chapters.md`.
  - Deferred independent playthrough and content-expansion gate: active browser-scaling/playtest plan and playtest record.
  - Professor's recording choice and the unresolved Chaos Event trigger/Elian response: `docs/VERTICAL_SLICE.md`.
  - Human audio-quality feedback: `docs/playtests/2026-11-03-research-chapters.md` and `docs/VERTICAL_SLICE.md`; keep automated audio behavior separate from listening-quality evidence.
  - Same-host full-world renderer results: `docs/performance/2026-11-03-hybrid-canvas-overview.md`. Dense starting-view intervals above 50 ms: `docs/performance/2026-11-03-world-ground-treatment.md`. Do not imply cross-device acceptance.
  - Full-suite approval requirement: `AGENTS.md` and `docs/TESTING_GUIDE.md`.
- Run `git diff --check`.
- Do not run the full test suite for this documentation-only change.

## Verification results

All 10 relative README links resolve. The checked-in `package-lock.json` exists; `package.json` defines `build` as `vite build` and `preview` as `vite preview --host 127.0.0.1`. Scope, story, audio, performance, and full-suite claims were checked against the linked project evidence. `git diff --check` passed with only LF-to-CRLF notices. Code Reviewer found no actionable findings. No tests were run because the change is documentation-only.
