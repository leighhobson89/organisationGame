# Plan: Compact Finder Search-Filter Coverage

**Status:** Complete (2026-11-04). The review finding is resolved with compact query-filter coverage; no application or CSS changes were needed.

## Goal and boundary

Exercise Item Finder text filtering in its existing 150% responsive layout test. The app already implements search filtering and separate Finder-announcements coverage verifies it; this follow-up adds compact viewport coverage for the query path.

Keep changes limited to `e2e/lab/item-finder-layout.spec.js` and this plan/related test documentation. Do not change application code, CSS, data, or authored content.

## Implementation and verification scope

- Extend the existing parameterized Item Finder layout case after its keyboard pagination reaches Page 2.
- Fill the search box with a deterministic query such as `Brass Cog`.
- Derive expected matches from the seeded fixture using the same `title`, `family`, `clue`, and `id` fields as the Finder filter.
- Assert the displayed matching count, reset to Page 1, and ordered result `data-testid` identities.
- Guard the fixture-derived expectation so the query matches at least one item and fewer than the full catalog.
- Keep the assertions in the existing viewport loop so 320x400 and 390x400 at 150% text are exercised alongside its 480px regression cases.
- Verify with `npx playwright test e2e/lab/item-finder-layout.spec.js --workers=1`. The existing implementation is expected to pass; this is a coverage-only follow-up, so no application regression is expected before the test addition.

## Focused test plan

The Item Finder layout spec should cover the normal fixture-backed case at each existing parameterized viewport. The `Brass Cog` query must return a nonempty strict subset of the seeded catalog; compare the matching-count text, `Page 1 of 1`, and the ordered result IDs to the fixture-derived matches. The filtered case follows the existing traversal to Page 2, ensuring a query change resets pagination.

## Acceptance criteria

- [x] The compact Finder test types the deterministic `Brass Cog` query.
- [x] Expected matching item IDs are derived from the seeded fixture; the expected matches are guarded as a nonempty strict subset.
- [x] The count, first-page reset, and ordered result identities match the query at each parameterized viewport.
- [x] The focused Item Finder E2E spec passed 4/4 with `npx playwright test e2e/lab/item-finder-layout.spec.js --workers=1`. The initial sandbox worker spawn returned `EPERM`; the rerun with process access passed.
- [x] Testing documentation records the resolved review follow-up; this plan is archived, leaving only the deferred human-playtest gate active in `docs/plans/`.

Code Reviewer identified a P3 coverage gap: the compact layout spec checked search focus but did not enter a query. The added assertions cover the filter count, Page 1 reset, and fixture-derived ordered result IDs across the existing viewports. Review found no actionable CSS scope or Save textarea height issues. The full suite was not run; the independent human-playtest/content-expansion gate remains open.
