# Plan: First-Playtest Onboarding and Clarity

**Status:** Completed (2026-11-05). The requested onboarding, item-evidence, destination, and safe new-laboratory flows are implemented and focused-verified. The independent human playtest/content-expansion gate remains open until that session is completed and reviewed.

## Objective

Give a first-time player a clear, accessible path through the opening task and the evidence-to-filing loop, make the collection and destination model understandable, and offer a safe confirmed way to start a new laboratory. Preserve save identity and recovery behavior; do not change the save schema.

## Scope and boundaries

### How to Play and first-action onboarding

- Add a persistent, accessible **How to Play** guide that remains discoverable and reopenable during play.
- Explain how to select an item; read its title, family, clue, and collection/series; compare that evidence to a labeled destination; track progress and discoveries in the header/Notebook; and use the world controls and save indicators.
- Present a concrete first task that directs the player to inspect a Harmonic Calibration item and match its evidence to the appropriate collection container.
- Make the opening guidance concise, keyboard accessible, screen-reader understandable, and dismissible without blocking ordinary gameplay. Reset the fresh-laboratory first-action guidance when starting a new laboratory.

### Item, Folio, collection, and destination clarity

- Replace the generic Harmonic Calibration `01`–`08` display titles with eight distinct themed names, using an explicit item-ID-to-canonical-title mapping. Keep item IDs as the identity source; do not derive identity or titles from current list position, and do not change serialized save data/schema.
- Strengthen the visual/text evidence on those items so a first-time player can connect the item clues and shared series to the Folio entry that identifies the collection.
- Surface the item's collection/series name in the Inspector, alongside its individual evidence.
- Clarify destination labels and types: permanent collection containers are filing destinations, while scratch pads are temporary work surfaces.
- State that permanent-container slots fill automatically and items may be filed in any order. Explain separately that puzzle pieces must be arranged in their authored sequence; do not imply that collection filing order controls puzzle order.

### Confirmed Start Over / New Laboratory

- Add a clearly labeled **Start Over** or **New Laboratory** action in Save & Restore and require an accessible confirmation that explains the consequences.
- On confirmation, preserve a recoverable backup of the current autosave before replacing it with a fresh 174-item laboratory. Keep existing manual save slots intact; do not repurpose or overwrite a manual slot as the backup.
- Reset live progression, selection/group state, open panels, transient feedback, and fresh-start/first-action onboarding state only after the backup and replacement autosave writes succeed. Reuse existing persistence envelopes and recovery paths; add no save-schema fields.
- Treat backup or replacement-write failure as a failed reset: retain the current running state and existing manual slots, avoid claiming that the new laboratory started, and show an accessible recovery/error message. Never clear the old autosave before the backup and fresh autosave are safely stored.

## Design and safety requirements

- Use the project's existing accessible panel/dialog and focus-return conventions for How to Play and confirmation; provide a clear cancel route and preserve keyboard operation.
- Keep How to Play available in every play state without coupling it to an individual save. Starting over restores fresh-start guidance; it does not delete manual slots or other unrelated preference data.
- Keep canonical content titles explicitly keyed by stable item IDs. The themed names must remain stable if catalog ordering changes, and existing placements, IDs, exports, and imports must continue to resolve as before.
- Preserve the existing autosave and import backup contract. The Start Over backup must contain the pre-reset autosave in the existing supported backup form and be distinguishable from manual slots.
- Handle unavailable storage, quota exhaustion, and exceptions while reading/writing backup or autosave through the current storage adapter/recovery UI. Fail safely before destructive replacement when the required backup or new autosave cannot be committed; do not silently fall back to an unbacked reset.
- Keep automated audio settings, story interpretation, renderer behavior, and unrelated save migrations outside scope.

## Implementation approach

1. Inspect the current onboarding, catalog title definitions, Folio content, Inspector, destination labels, puzzle ordering, Save & Restore state flow, and autosave/backup helpers.
2. Implement the persistent How to Play guide and fresh-start first-action content using existing panel/accessibility patterns.
3. Add ID-keyed Harmonic Calibration canonical display titles and clearer evidence, expose collection/series in the Inspector, and clarify permanent-container versus scratch-pad behavior and ordering guidance.
4. Implement the confirmed Start Over transaction: validate/read the current state, commit a recoverable current-autosave backup, commit the fresh default save, then reset live/transient UI. Preserve manual slots and existing schema. On any precondition/write failure, retain the current run and report the failure accessibly.
5. Run the focused regressions listed in the completed Test Plan, inspect the scoped diff, and update relevant documentation and the human-playtest briefing.

## Acceptance criteria

- A player can open and close the persistent How to Play guide by keyboard and pointer at the start and after progress; headings, instructions, controls, and actions have accessible names, focus behavior, and readable layout.
- Fresh-start guidance explains the evidence-to-container task and remains visible until the player takes the intended first action; after Start Over the guidance returns.
- The eight Harmonic Calibration items have distinct themed display titles mapped by stable IDs, and their Folio-relevant clue/series evidence is understandable. Existing IDs, placements, save imports/exports, and item order are unchanged.
- The Inspector identifies each item's collection/series. Permanent containers and scratch pads are clearly distinguished, automatic slot filling and order-independent filing are stated, and puzzle sequence order is described separately.
- Start Over requires an explicit confirmation. After confirmation, the pre-reset autosave is recoverable through the existing backup/recovery path, the fresh 174-item laboratory autosaves, manual slots remain byte-for-byte intact, and progress/transient UI/onboarding state reset.
- Cancelling confirmation makes no state change. If localStorage is unavailable or a backup/fresh-autosave write fails, the current running state and manual slots remain intact, no successful reset is reported, and the player receives clear accessible recovery guidance.
- No save-schema change or unrelated gameplay behavior change is introduced.
- Focused unit/E2E checks pass for onboarding access and reset, ID-keyed titles/evidence and Inspector metadata, destination and puzzle ordering guidance, confirmation/cancel, backup/manual-slot preservation, reset persistence, and storage failure safety. No full suite is run without approval.
- Update the relevant game/readme/testing documentation, archive this finalized plan with a dated filename, and leave the pre-existing active `browser-scaling-playtest-gate.md` untouched and active.

## Documentation updates

- Update the playable-slice or first-session documentation with the How to Play entry point, item/Folio task, collection versus scratch-pad guidance, progress/Notebook cues, and controls/save behavior.
- Document the Start Over confirmation, autosave backup guarantee, manual-slot preservation, and localStorage failure behavior in the Save & Restore/testing guidance.
- Keep claims limited to implemented and focused-verified behavior. Do not mark human playtesting or the content-expansion gate complete.

## Test plan

### Test Specialist red baseline

`npx playwright test e2e/lab/first-playtest-onboarding.spec.js --reporter=line --workers=1` failed **3/3 as expected** before implementation because the How to Play button/guide and Start Over action do not yet exist. The initial sandbox launch returned `spawn EPERM`; the process-access rerun reached all three tests and recorded the expected failures.

### Focused acceptance coverage

After implementation, rerun the same spec and extend/adjust focused cases to verify:

- The persistent How to Play control and guide can be reached, read, closed, and reopened by keyboard and pointer; its first-task, item evidence, collection/progress/Notebook, controls, and save guidance are present and accessible.
- Fresh-start guidance explains selection and evidence-based filing, returns after Start Over, and does not obstruct ordinary play.
- The eight Harmonic Calibration items render distinct ID-keyed canonical titles and clues that connect to their Folio collection; Inspector exposes the collection/series; permanent container and scratch-pad labels explain automatic slots and order-independent filing separately from ordered puzzle sequences.
- Start Over confirmation cancellation preserves the current run. Confirming preserves a recoverable pre-reset autosave backup and all manual slots, writes the fresh 174-item autosave, clears progress/transient UI, and restores onboarding.
- A failed/unavailable localStorage read or backup/fresh-autosave commit leaves the current run and manual slots intact, reports failure accessibly, and does not claim the reset succeeded.

Run this focused Playwright spec, and only additional narrowly related unit/E2E checks needed to cover these acceptance cases. Do not run the full suite without approval. Record final commands and results below; update user-facing documentation and archive the finalized plan.

### Final verification

- `npx playwright test e2e/lab/first-playtest-onboarding.spec.js e2e/lab/first-action-guidance.spec.js --reporter=line --workers=1` passed **7/7**. Coverage includes opening/closing/reopening How to Play, first-task focus, distinct titles and series, auto-filled order-independent Folio slots, confirmed reset/cancel, fresh 174-item state and first-action guidance restoration, autosave backup, unchanged manual slots, backup/autosave write failures, old-title normalization, and placement/progress preservation.
- `npx playwright test e2e/lab/inspector-panel-layout.spec.js --grep "200% group Inspector keeps all eight evidence rows|single-item Inspector and toolbar remain readable and reachable at 320x360 with 200% text|short-height resize across 400" --reporter=line --workers=1` passed **3/3**, including keyboard access to the last clue in an eight-item group at 200% text.
- `npx playwright test e2e/lab/header-responsive-layout.spec.js --reporter=line --workers=1` passed **23/23**, covering the added Help action at compact widths, phone sizes, large text, and desktop breakpoints.
- `npm run build` passed with Vite 8.3.5 (63 modules). `git diff --check` found no whitespace errors; Git reported expected LF-to-CRLF conversion notices. The sandbox initially blocked worker/config subprocess creation with `spawn EPERM`; process-access reruns passed. One initial combined Inspector attempt had a transient focus assertion; the isolated retry and subsequent full focused rerun passed.
- No full unit or E2E suite was run. No independent human playthrough was performed; this plan prepares the project for that session and does not close the human gate.

## Verification boundaries

- Run focused tests for this feature area and the production build only if needed by the implementation handoff.
- Do not run the full unit or E2E suite without user approval, per `AGENTS.md`.
- Application changes and the README, playable-slice, roadmap, Testing Guide, and Phase 1 human-testing handoff were updated. No save-schema change was introduced.
