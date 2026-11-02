# Development Instructions

## Development Handoff Workflow

Every development prompt should follow this ordered handoff process:

1. The architect plans the change and defines its implementation and
   verification scope.
2. The documentation specialist records the plan in `docs/plans/`.
3. A test specialist writes focused failing regression tests from the plan
   before implementation begins. This runs in parallel with step 2.
4. The documentation specialist updates the plan with the test plan.
5. An implementation specialist carries out the plan while preserving
   behavior outside the requested scope. This runs in parallel with step 4.
6. Run the focused tests and iterate until they pass.
7. After implementation, review, and verification, the documentation
   specialist updates relevant project documentation, archives the finalized
   plan in `docs/archive/plans/` with a dated, descriptive filename, and leaves
   `docs/plans/` empty.

For small, reviewable changes, prefer `apply_patch` or other patch-based edits
over direct writes or edits.

## Quick Mode

When a user includes the exact code word `QMODE` in a development prompt or a
steering message during an active task, the main agent may make a minor change
directly without the specialist handoff or tests. Decide whether the change is
minor and whether documentation needs updating. If it is not clearly minor,
follow the normal handoff workflow.

## Documentation

Update relevant project documentation when code changes affect behavior, data
formats, user-visible presentation, persistence, or tests. Add or update
regression tests when behavior changes.

## Plan Archiving

After implementation, archive every executed or finalized plan in
`docs/archive/plans/`, preserving its content in a dated, descriptive filename.
Keep `docs/plans/` empty after archiving.

## Test Execution Approval

Ask the user for approval before running a full test suite. Focused tests for
the requested functional area may be run without prior approval.
