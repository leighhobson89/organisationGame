# Plan: README Story Evidence Alignment

**Status:** Completed and reviewed on 2026-11-04. Both README story passages now reflect the supported Unsent Apology evidence and preserve the unresolved points about the choice, the Chaos Event, and Elian's response.

## Goal and scope

Update only the README opening story summary and its `Known limitations and open gates` story bullet. Both passages currently state that clues support the Professor choosing to preserve the recording. The supported account is narrower: the Unsent Apology shows that the Professor feared Elian would blame the machine for an unnamed choice. The recovered records do not name the choice or establish whether or how it related to the Chaos Event. The Event's original trigger and Elian's response remain unresolved.

The opening summary should say:

> The Unsent Apology shows that the Professor feared Elian would blame the machine for an unnamed choice. The recovered records do not name that choice or establish whether or how it related to the Chaos Event; they also do not establish the Event's original trigger or Elian's response.

The `Known limitations and open gates` story bullet should say:

> **Story:** The Unsent Apology shows that the Professor feared Elian would blame the machine for an unnamed choice. The records do not name it or establish whether or how it related to the Chaos Event; the Event's original trigger and Elian's response remain unresolved. See the [playable-slice notes](docs/VERTICAL_SLICE.md).

## Boundaries

- Change only those two README story passages.
- Keep game features, the expansion gate, and all other documentation unchanged.
- Do not change runtime behavior, story content, save data, or progression.

## Test plan

The Test Engineer added `tests/unit/docs/readme-story-evidence.test.mjs`. It checks that both README story passages match the supported apology evidence and preserve the unresolved points. The focused command is:

~~~sh
node --test --test-isolation=none tests/unit/docs/readme-story-evidence.test.mjs
~~~

The red baseline exited 1 as expected: the opening README summary omitted the apology evidence and made the unsupported preserve-recording claim. The test covers both the opening summary and Known limitations story bullet, including the unresolved trigger, Elian response, and uncertainty about how the choice related to the Event. After the README correction, the focused command passed **1/1**.

## Documentation consistency verification

- Confirm the opening story summary and Known limitations story bullet state the supported evidence and unresolved points consistently.
- Confirm both outdated assertions that the Professor chose to preserve the recording are removed from these passages.
- Confirm the expansion-gate text, links, game-feature summary, and other README sections are unchanged.
- The focused documentation regression passed **1/1** after the README correction.
- Scoped review found no remaining issues after the test assertions were extended to check the unresolved Event trigger and Elian response and the uncertain connection between the choice and Event.
- `git diff --check -- README.md` reported only the expected LF-to-CRLF working-copy notice.
- No runtime test suite or build was run because this was a prose-only documentation change.

## Finalization

Archived as `docs/archive/plans/2026-11-04-readme-story-evidence.md`. The browser-scaling and human-playtest gate remains active in `docs/plans/`.
