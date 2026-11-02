# Plan: Rewrite generic agent guidance

## Scope

Rewrite the root `AGENTS.md` to retain its reusable development handoff, QMODE
exception, documentation upkeep, plan archiving, and test approval guidance.
Remove references tied to the copied project's mechanics, files, test harness,
browser setup, and machine standards.

## Implementation

- Keep the ordered handoff while describing specialist roles generically.
- Keep patch-based editing as the preference for small, reviewable changes.
- Keep general documentation and plan-archive expectations.
- Remove project-specific testing commands, setup notes, and feature guidance.

## Verification

Read through the revised `AGENTS.md` and inspect the diff for project-specific
references. Do not run tests for this documentation-only rewrite.
