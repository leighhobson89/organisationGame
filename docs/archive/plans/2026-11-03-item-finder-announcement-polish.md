# Plan: Polish Item Finder Announcements

## Goal

Keep Item Finder's visible filtering results, match count, and page text
immediate while making screen-reader updates concise. Remove live-region
behavior from the visible result count and page text, and add one initially
empty polite status region for settled query-result counts and page navigation.

Typing should announce only the final matching-result count after input settles.
Activating Previous or Next should announce the new page once through that same
status region.

## Constraints

- Keep the visible matching count, result list, result order, and page text
  immediate and unchanged.
- Remove `aria-live` from the visible matching-count and page readouts.
- Use one initially empty polite status for both debounced query-result
  announcements and Previous/Next page announcements.
- Skip announcement on initial mount. Debounce query changes so a typing burst
  produces one final matching-result announcement.
- Announce each Previous/Next page change once through the shared status.
- If Previous or Next is activated before a pending query debounce settles,
  cancel and clear the timer, update the page, and announce both the new page
  and current result count together as `Page N of M. X matching items.`. A
  stale query timer must not overwrite this message afterward.
- For a normal settled query, announce `X matching items. Page 1 of M.` once.
- Preserve keyboard focus and navigation, result selection, panel behavior,
  keyboard isolation from world panning, and mouse/touch scrolling.
- Do not change save/schema data, content, camera behavior, or rendering.
- Do not run the full test suite without user approval.

## Affected files

- `src/ui/ItemFinder.jsx`: make the visible count/page readouts non-live, add
  the single polite status, and debounce only its query-result announcement.
- New `e2e/lab/item-finder-announcements.spec.js`: cover query and page
  announcements while confirming immediate visible filtering and page text.
- Existing `e2e/lab/panel-coordination.spec.js`: run to protect focus,
  keyboard/world input isolation, and wheel/touch scrolling.

## Verification scope

- The focused new E2E verifies the visible result count and page update without
  live semantics; the status is empty on mount; sequential multi-character
  typing updates visible results immediately while the status remains quiet,
  then coalesces to one final result-count announcement; clearing the query
  announces the final count once; and both Previous and Next each announce
  their changed page once through the same status. Settled query/clear messages
  use `X matching items. Page 1 of M.`; page messages use
  `Page N of M. X matching items.`. It also checks that a page action before
  the query timer settles cancels that timer and reports the current page and
  matching count together without a later stale overwrite.
- Run `npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js` to
  confirm Finder focus handling, keyboard isolation, and wheel/touch scrolling
  remain unchanged.
- Run `npm run build` and request code review after implementation.
- Do not run the full test suite without user approval.

## Test plan

The Test Engineer added four focused cases in
`e2e/lab/item-finder-announcements.spec.js`:

1. `Finder count and page readouts are not live, with one initially empty
   polite status` checks that the visible count/page have no `aria-live` and
   that the shared polite status is empty on mount.
2. `sequential typing announces one settled count and clearing the query
   announces once` checks immediate partial/final result, count, and page
   updates; silence during query entry; one combined
   `X matching items. Page 1 of M.` announcement; and one combined announcement
   after clearing the query.
3. `Next and Previous each announce exactly one page change through the shared
   status` checks immediate page/result updates and one combined
   `Page N of M. X matching items.` status announcement for each direction.
4. `Next during a pending query announces the current page and count without a
   stale overwrite` verifies that activating Next before the 300 ms query
   debounce expires cancels the timer and leaves one combined page/count
   announcement in the shared status.

Focused command:

~~~sh
npx playwright test e2e/lab/item-finder-announcements.spec.js --workers=1
npx playwright test e2e/lab/item-finder-announcements.spec.js --workers=1 --grep "Next during a pending query"
~~~

The red baseline was 3 failed. Case 1 found that the visible `.item-finder-count`
still had `aria-live="polite"`. Case 2 confirmed immediate filtering/count/page
updates and a quiet status during typing, but the final-query announcement
history remained empty instead of containing one settled count; clearing the
query also updated the visible results without an announcement. Case 3 changed
the visible page to 2 and back to 1 and verified the matching first result,
but the shared status history remained empty instead of recording Next and
Previous once each. The Test Engineer's `git diff --check` was clean.

The pending-query race regression's focused red command is:

~~~sh
npx playwright test e2e/lab/item-finder-announcements.spec.js --workers=1 --grep "Next during a pending query"
~~~

It fails because clicking Next first sets the status to `Page 2 of 7.`, then
the pending timer overwrites it with `174 matching items.` after 350 ms,
producing two mutations instead of the combined `Page 2 of 7. 174 matching
items.` message. The visible page and first result update immediately.

## Final verification (2026-11-03)

- `npx playwright test e2e/lab/item-finder-announcements.spec.js --workers=1`
  passed 4/4. `npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js`
  passed 8/8.
- `npm run build` passed with Vite 8.3.5. Code Reviewer found no actionable
  findings; the scoped diff-check was clean.
- The race red baseline showed the pending query overwrite `Page 2 of 7.` with
  stale `174 matching items.` after 350 ms. The final regression requires a
  single `Page 2 of 7. 174 matching items.` announcement.
- The full test suite was not run.
