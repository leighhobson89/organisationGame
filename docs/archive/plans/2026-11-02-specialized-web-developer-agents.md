# Plan: Add specialized web developer agents

## Scope

Replace the Python developer agent with three expert role prompts for
JavaScript development, React UI development, and CSS development. Keep the
existing agent frontmatter and prompt conventions.

## Implementation

- Remove `agents/python-developer.md`.
- Add `agents/javascript-developer.md` for JavaScript language and runtime work.
- Add `agents/react-developer.md` for React application and UI work, including
  accessibility.
- Add `agents/css-developer.md` for styling, responsive layouts, and design
  systems.
- Give each role file permissions that match its technical scope and describe
  its expertise with concrete practices.

## Review

- Check that the new roles have distinct responsibilities and consistent
  frontmatter.
- Inspect the final diff to confirm the Python role is removed and unrelated
  agent roles remain unchanged.
- Reviewer reported no actionable findings.

## Test plan

- Run the focused regression check with:
  `node --test --test-isolation=none tests/unit/agent-roles/agent-specializations.test.mjs`
- Verify it checks removal of the old Python role, metadata and expertise in
  each new role, and each role's scoped file extensions.

## Final results

- The focused regression check passed: 4/4 tests.
- Review completed with no actionable findings.
