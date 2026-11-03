# Plan: Chronology Progress Save and Reload

**Status:** Complete and reviewed on 2026-11-03. The chronology browser reload regression, focused verification, documentation, and code review are complete. Archived at `docs/archive/plans/2026-11-03-chronology-save-reload.md`. The separate CUA manual reload and independent human-playtest/content-expansion gate remain open.

## Goal

Close the browser-verification gap for the save-and-resume contract: after the
player completes the three chapter-two collections and solves **Chronology of
the Last Bell**, confirm a browser reload restores the resulting progression.

The existing migration journey already reaches the Chronology Wheel and checks
the v3 autosave, solved puzzle ID, and notebook discovery. It currently ends
without reloading that saved state.

## Scope and constraints

- Extend the existing focused E2E journey in
  `e2e/lab/research-chapter.spec.js`.
- Reload only after the chronology solve and confirmed autosave.
- Verify the restored v3 state, including all 174 items, the three completed
  chapter collections, the solved chronology puzzle, the **Chronology Wheel**,
  the notebook discovery, the purchased Missing Member Compass, and
  representative item placements.
- Confirm the restored Engine and chapter progress in the visible interface,
  as well as the persisted state.
- Do not change catalog content, progression rules, runtime behavior, or the
  save schema unless the regression exposes an actual defect.
- Keep `docs/plans/browser-scaling-playtest-gate.md` active. This automated
  check does not count as an independent human playthrough or unblock content
  expansion.

## Implementation and verification

1. Add reload assertions to the existing chronology E2E journey.
2. Run the focused chronology migration journey and iterate only if it exposes
   a save/reload defect.
3. Build the app and request focused code review.
4. Update the testing guide, roadmap, vertical-slice notes, and playtest report
   to distinguish verified automated persistence from the still-open human
   playtest and audio-quality checks.
5. Archive this plan after verification and review; keep the independent
   browser-scaling/playtest plan as the active gate.

## Test plan

Focused regression: the existing chronology migration journey now checks the
v3 autosave before reload and after browser reload. It verifies 174 items,
3 of 3 chapter collections, the Chronology Wheel, the solved chronology puzzle,
notebook discovery, and the purchased Missing Member Compass. It checks every
chapter item is correctly filed at its collection destination, preserves the
migrated item's position/placement/rotation, and confirms item, progress,
notebook, and camera state are unchanged by reload. The reloaded notebook panel
also visibly contains **The Last Bell**.

Focused command:

```sh
npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js --grep "v2 migration preserves the old placement"
```

Baseline after adding the regression: **1/1 passed**. Final focused rerun also
passed **1/1**. The first default-sandbox attempt stopped before test execution
with `spawn EPERM`; rerunning with process access passed. `npm run build`
passed with Vite 8.3.5, and Code Reviewer found no actionable issues. No runtime
code changed. The full test suite was not run.

## Completion

Automated browser reload evidence now covers the full chronology progression
and v2-to-v3 migrated placement. This does not verify the unfinished manual CUA
reload or count as an independent human playthrough. Keep
`docs/plans/browser-scaling-playtest-gate.md` active; independent human feedback
and the content-expansion decision remain open.
