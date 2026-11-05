# Architecture and Technical Status

**Status:** The Vite and React JavaScript foundation, two playable research chapters, and derived full-restoration ending are implemented. The hybrid Canvas overview meets the one-host full-world interaction gate at up to 5,024 entities; the dense 5,024-item starting view now also switches to Canvas and measured 16.8/16.7/16.8ms wheel p95 across three trials. Optional synthesized audio is wired and automated-verified; human listening quality and the independent playthrough remain open, and larger authored content stays gated. The strongest reading of the Unsent Apology is that the Professor chose to follow the first stable impression by ordering an eastward survey toward the sealed bell chamber. Later records place that investigation before the bell, but do not establish that his choice caused the Chaos Event. The Engine is a recorder/witness, while the Event's original trigger and Elian's response remain unresolved.

## Technology and source boundaries

The app runs entirely in the browser with Vite, React, plain JavaScript ES modules, and CSS. There is no backend.

- `src/game/content/` defines the laboratory layout, authored collections and puzzles, skills, notebook discoveries, and seeded item generation.
- `src/game/domain/` contains placement and puzzle-completion transaction planning, collection progression, skill behavior, and derived full-completion checks and statistics.
- `src/game/audio/` contains the asset-free transient gameplay event publisher and optional synthesized Web Audio adapter. Audio preferences live separately from game saves.
- `src/game/world/` contains camera transforms, the uniform-grid spatial index, and shared placement-slot allocation.
- `src/game/persistence/` normalizes state, migrates saves, manages three local manual slots, compresses exports, imports saves, and handles autosave recovery.
- `src/app/`, `src/ui/`, and `src/styles/` contain the React shell, accessible controls and panels, and visual system.
- `src/app/useGamePersistence.js` owns initial save load/recovery, normalized game/autosave state, the autosave worker and coordinator, snapshots, imports, and starting a fresh game. It invalidates the coordinator synchronously on each game-state update and disposes worker/coordinator resources at teardown. `App.jsx` retains transient selection, skill/puzzle, preferences/audio, and panel state.

While `saveStatus` is `Saving…`, the persistence hook registers a `beforeunload` listener that asks the browser to confirm navigation. The effect is keyed to the save status: it removes the listener as soon as the status changes and also removes it when the hook unmounts. This protects the debounce/worker-save window by warning the player; it does not synchronously flush or complete a save during page unload.

Import handling validates the incoming payload before making changes, backs up the current save before applying the new state, and notifies `App` before the state update so completion-audio suppression is set before a complete save is applied. Invalid imports preserve the current save and state. The hook keeps existing recovery/corrupt-save handling, autosave enable semantics, schema, and persisted fields.

## World, content, and interaction

Camera-only view updates skip unchanged detail cards: `LabObject` is memoized, selection callbacks and highlight-source props keep stable identities, and actual item, selection, highlight, or drag changes still update the affected card. Compass highlight IDs also remain stable across camera-only `App` renders. In overview mode, this keeps the Canvas redraw effect from clearing and repainting unchanged content; a real Compass change continues to redraw its highlight. These optimizations preserve camera and save behavior, renderer thresholds, accessibility, and the 64-total DOM overlay cap.

The multi-selection Inspector compares every selected object's title, family, and clue using a semantic definition list. Details scroll independently while batch-move controls stay pinned, and the 40-item selection cap is fully represented.

The laboratory is a continuous 5,200 × 3,400 coordinate space. A fresh game contains 174 deterministic entities: the original 150 canonical items plus 24 authored second-chapter records. The original IDs and definitions remain unchanged. The chapter adds three collections of authored records spanning handwritten notes, experiment records, map fragments, and formula cards. At detail scale, visible objects are positioned DOM elements. At overview scale (0.4 or lower) or when more than 256 items are visible, a Canvas paints the full item set while the renderer keeps a 64-total DOM overlay cap that includes ordinary cards and forced selected, dragged, and keyboard-focused cards. Its backing pixels per world unit are `round(clamp(cameraScale * devicePixelRatio, 0.5, 1) * 8) / 8`; quantized camera-scale steps and DPR changes update backing dimensions and drawing scale without changing CSS geometry. A hidden overview canvas releases its bitmap by switching to `1×1`, then recomputes its backing resolution when reopened. At scale `0.45` for the full `5200×3400` world, DPR 1 uses `0.5` backing pixels per world unit (`2600×1700`) and DPR 2 uses `0.875` (`4550×2975`). Hysteresis returns to detail only at scale 0.5 or higher and 192 or fewer visible items. This leaves the 174-item starting view in detail while moving the dense 5,024-item start view to Canvas; the latter's three measured wheel-zoom p95 values were 16.8, 16.7, and 16.8 ms. See the [dense starting-view threshold report](performance/2026-11-03-dense-start-render-threshold.md) for trial data and limits. A 320px uniform-grid index supplies viewport candidates and Canvas hit-test candidates; exact rotated-card geometry resolves the topmost hit. The keyboard-accessible Item Finder paginates 25 items at a time and can focus distant objects into crisp detail.

At widths up to 720px, the Notebook/Skills left panel and Inspector/Puzzle right
panel are mutually exclusive. Opening one side closes the other; selecting an
item closes the left panel and opens Inspector. Desktop retains its two-side
coexistence and selection behavior. If a desktop layout with both sides open is
resized to compact width, the right panel remains open and the left closes.
Collection completion on compact prioritizes a newly unlocked Puzzle; if no
puzzle unlocks, it shows Notebook and closes Inspector. These are transient
panel-visibility rules and do not alter selection, progression, saves, or
camera state.

At compact widths, the Clockwork Atlas and side panels are mutually exclusive:
opening Atlas closes Notebook, Instruments, Inspector, or Puzzle, and opening a
side panel closes Atlas. Desktop Atlas/panel coexistence remains unchanged. If
Atlas and a right panel are open when resizing to compact, Atlas closes and the
right panel remains. Closing Atlas from a side-panel control keeps focus on
that control; when resizing closes an Atlas that held focus, focus returns to
the Atlas toggle. These transitions leave the camera, selection, and save data
unchanged.

At compact widths, Finder and Notebook/Skills are mutually exclusive. Opening
one closes the other. Desktop Finder/Notebook coexistence remains unchanged,
as do existing Finder/Inspector and Atlas/Finder transitions. If desktop
resizes to compact while Finder and a side panel are both open, Finder closes
and the side panel remains. A side-panel action that closes Finder keeps focus
on that control; if resizing closes a Finder that held focus, focus returns to
the Finder toggle. These are transient UI changes and do not affect selection,
camera state, or saves.

Item Finder updates its visible filtered results, match count, and page text
immediately; only its separate polite status is debounced. The visible count
and page are not live regions. A settled query or query clear announces the
matching count and current page together, while Previous/Next announces the
new page and count once. If navigation occurs before a query timer settles,
the page action cancels and clears that timer and announces the current page
and count together, preventing a stale query message from overwriting it.
Announcements are transient and do not change filtering, result order, focus,
scrolling, camera behavior, or saved state.

Pressing Escape while the Item Finder search field is focused closes the
Finder through its existing `onClose` callback. The existing close path returns
focus to the **Find an item** toolbar control; this dismissal leaves camera
position and game state unchanged.

Fresh default-seed filler placement remains deterministic within the existing family clusters. The first-session refinement reduced axis-aligned overlap pairs in the 174-item starting layout from 259 to 1, with no fully occluded items. It preserved authored cluster coordinates, item count/order/IDs/families/clues/destinations, and saved item positions. The Inspector now scrolls long details separately while keeping its move controls visible at 1084 × 827 and at the 390 × 480 responsive viewport; 390 × 600 also passes.

Pointer-to-world math is shared by pan, zoom, and item movement. Touch users can pinch with two fingers to zoom around the moving midpoint; lifting one finger rebases the remaining contact into a continuous one-finger pan. A second touch during item drag cancels the drag without dropping or moving the item. The gesture commits camera changes through the existing save path and adds no saved fields. The world also supports keyboard panning/zoom, item selection, inspector moves, and cancellation with pointercancel or Escape. Keyboard activation hands focus to the inspector's target selector; after Move succeeds or is rejected for capacity, focus stays on Move and a live status announces the result.

Closing Inspector returns focus to its selected world-item control. For a group
selection, the current selected item is preferred, with the first selected ID
as a fallback when that item cannot receive focus. A candidate is accepted
only when it becomes `document.activeElement`; otherwise the next selected ID
is tried. Closing Puzzle returns focus to the persistent Open Puzzle header
control. These close actions only restore keyboard focus; selection, camera,
and progression remain unchanged.

When a compact Inspector move completes a collection without unlocking a
puzzle, focus returns after the panel transition commits to the persistent
`multi-selection-toggle`. Desktop Inspector completion and direct world drops
remain unchanged.

When a keyboard-activated Notebook collection row closes the Notebook and
recenters its destination, focus returns after the panel transition to the
persistent `toggle-notebook` control. The polite `world-announcer` names the
destination, and activating the focused toggle reopens Notebook. This uses the
existing camera persistence path without changing collection or progression
state.

When a newly unlocked puzzle opens after a collection move, `PuzzlePanel`
focuses its first available choice so keyboard play can continue. If the puzzle
has no available choice, such as an already-solved puzzle, focus goes to its
heading. This applies when a puzzle panel mounts and does not change puzzle,
placement, progression, or save state.

The toolbar keeps the visible zoom percentage as a non-live readout and exposes
settled zoom changes through a separate polite screen-reader status. The initial
camera value and pan-only changes are silent. Wheel bursts coalesce to one
final percentage; toolbar zoom announces after its update settles. Pinch
announcements remain suppressed for the entire active pinch, including pauses
longer than the debounce interval, then report the final scale once when a
finger lifts. The continued one-finger pan stays silent. A rollback to the last
announced percentage does not repeat that announcement. The controller's
`pinchActive` signal is transient UI coordination only; camera math, save
behavior, renderer policy, and world content are unchanged.

`src/ui/useWorldViewportController.js` owns camera, culling, and viewport-size
state; the spatial index; camera scheduling and zoom timers; pointer, touch,
pinch, and Space gesture refs; drag preview; the keyboard listener;
`ResizeObserver`; and the main pointer, wheel, zoom, and focus handlers.
`WorldViewport` keeps DOM refs and Atlas state, and supplies the Atlas-gated
camera-preview and title-reveal positioning callbacks. External camera changes
cancel and release active gestures without rolling back the incoming camera;
resize and unmount paths refresh or cancel work and release captures/timers.

Selected title reveals remain readable while allowing pointer input through to
another card beneath them. The selected reveal uses `pointer-events: none`; the
controller checks its screen bounds so a pointer over the reveal's empty spill
area does not start a world pan, while an overlapping different card can still
be selected or dragged. Keyboard/focus behavior and card geometry are unchanged.

Pointer drops and inspector moves use one capacity-aware slot allocator. It chooses the nearest free slot for pointer placement, counts invalid items against capacity, rejects new arrivals to full targets without changing state, and allows an occupant to move within its current full target.

The toolbar's accessible multi-selection mode lets pointer, touch, or keyboard users toggle object membership without starting a drag. The focused object's membership is exposed through `aria-pressed`, and the toolbar shows the selected count. Entering the mode carries the currently inspected object into the group. The selection is transient app state and is excluded from game state, saves, and the v3 schema. It is capped at 40 objects to match the largest destination and keep the hybrid Canvas renderer's 64-total DOM overlay cap available for selected items and other forced cards.

Inspector batch movement stages target slots while treating selected occupants as vacated. It commits all placements together only when every item fits; a capacity failure changes no placements, progression, rewards, events, or saved state and preserves the selection. Each committed item is validated independently, so a wrong-destination item remains visibly misfiled while correct placements count normally. Collections, puzzle unlocks, rewards, and related gameplay events are derived once from the final committed state. The existing single-item move flow is unchanged.

`src/game/domain/placementTransaction.js` plans single and batch placements as pure domain calculations. `planSinglePlacement` and `planBatchPlacement` return candidate item, progress, and discovery changes plus movement, validation, completion, unlock, and discovery outcomes; allocation rejection returns a reason without partial changes. The planners preserve clamping, slot allocation, catalog order, validation, rewards, and puzzle unlock rules. A single placement adds only the last newly completed collection's discovery, while a batch adds discoveries for all newly completed collections. `App.jsx` applies successful results and retains persistence coordination, audio, toast, selection, panel, and focus effects.

`src/game/domain/puzzleCompletion.js` exports the pure `planPuzzleCompletion({ game, puzzleId })` transition. It checks duplicate solves, puzzle lookup, collection prerequisites, and unlock state in that order. No-op outcomes include a reason and no next game; successful outcomes return an immutable `nextGame` with solved puzzle, reward clue, and monotonic invention-stage updates, plus the stage transition. `App.jsx` retains puzzle-completion, stage-change, and assembly audio events, toast wording, and UI coordination.

The world navigation menu's **Palimpsest Engine** target keeps the Engine centered and fits its existing bounds to the available viewport. It reaches 100% when the target fits and reduces the scale on narrow viewports so the complete Engine remains visible.

The World Jump select is a repeatable navigation action menu. It starts with a disabled neutral option `value=""` labeled **Jump to location**, while **Starting area** (`start`) remains a real selectable action. After each jump, the selection resets to neutral so the same destination, scratch pad, or Starting area can be selected again. Its polite `world-announcer` reports the resolved target after successful jumps; collection jumps identify both the collection and first unfinished item. Repeating a route announces it again even when the message is identical, while ordinary camera pan and zoom remain silent. Navigation retains existing camera persistence without changing placements, progression, or save schema; fresh-start framing and Reset view remain unchanged.

World target focus buttons keep their visible phrase **Focus** while exposing target-specific accessible names: destination controls use `Focus ${destination.label}` and scratch-pad controls use `Focus ${pad.label}`. Activating either type recenters the world on that target through the existing camera update and persistence path.

`InventionCore` also receives the live camera scale. At 60% zoom or lower, it uses a compact overview treatment: the Engine title and stage chip remain readable, while the synopsis is visually hidden and retained as the section's accessible description. Above 60%, the complete title, synopsis, and stage layout returns. This keeps the Engine's world footprint, stage/progression state, and save data unchanged.

The optional two-point **Aether Wayfinder** is available for a selected item
that is not correctly filed, whether it is in the workspace, a temporary
scratch pad, or a misfiled destination. It resolves the item's canonical
`correctDestinationId`, focuses that destination at a minimum preferred scale
of 0.72 through `fitTargetScale`, and shows a seven-second guided marker with
the text **For this item**. The destination's accessible name and one
Wayfinder-specific polite live status include the item title and destination;
the camera zoom readout may announce zoom separately. The skill changes no
item placement, validation, or progression.

The content-free **Clockwork Atlas** minimap represents the full 5,200 × 3,400
world as bounded item-density bins, destination/scratch-pad/Engine landmarks,
and the current camera rectangle clipped to `worldBounds`. A centered,
letterboxed projection maps atlas input back to world coordinates. Clicking or
dragging recenters the camera without changing zoom. Keyboard users move a
crosshair with arrow keys, press Enter to recenter, and press Escape to close
the Atlas and restore focus to its toggle. A polite status reports location
and zoom. Only one of Atlas and Item Finder can be open at a time. The Atlas is
collapsed by default at 390 × 480 and 320 × 480; reduced-motion settings make
map and camera changes immediate. Atlas visibility and crosshair are transient
UI state; no world content, entities, or save fields are added. Camera
recentring uses the existing camera field and persistence path.

`src/ui/WorldAtlasPanel.jsx` owns the Atlas panel's accessible presentation and
derived display geometry (density cells, camera outline, and projected
crosshair). `WorldViewport` retains Atlas interaction state and orchestration,
including camera gestures, Finder mutual exclusion, and the callbacks passed to
the panel.

At viewport widths up to 720px, the world toolbar wraps instead of shrinking
controls or clipping them in a horizontal scroller. Its children retain their
content width, the location selector has a 154px minimum, and the toolbar stays
inside 10px side gutters. Mobile CSS repositions the world hint and selection
toast to prevent overlap with each other and the toolbar at 320 × 480 and
390 × 480. The desktop toolbar remains in its existing single row. This is a
CSS-only layout change; control semantics, camera/game state, and saves are
unchanged.

For short compact layouts from 360px through 479px high, the 44px toolbar rail
tracks left and right overflow as it scrolls and when its viewport or content
resizes. `WorldViewport` renders non-interactive brass chevrons as siblings
6px outside the clipped rail edges. They do not cover control labels or change
toolbar geometry, and they are absent when the rail fits.

## Transient gameplay audio events

`src/game/audio/audioEvents.js` exposes the global `subscribeGameAudioEvents(listener)` API. Subscribers receive every event published while they are subscribed and can unsubscribe; events are discarded immediately when there are no listeners and are never queued, retained, or replayed. The stable event catalog has 12 names: `item.pickup`, `item.drop`, `item.placement.correct`, `item.placement.invalid`, `collection.completed`, `puzzle.discovered`, `puzzle.completed`, `skill.unlocked`, `skill.activated`, `machinery.stage.changed`, `invention.assembled`, and `invention.activated`. Payloads contain only small IDs, target fields, and stage fields. Events follow existing drag and progression guards; loading an already-complete save does not emit final activation, while the actual false-to-true completion transition does. The publisher itself has no playback or persistence; the optional adapter below consumes its events.

`src/game/audio/webAudioAdapter.js` subscribes to that bus and plays short, restrained oscillator and gain-envelope cues without audio files, network requests, added dependencies, or continuous music. Its event mapping covers the full catalog:

| Event | Cue |
| --- | --- |
| `item.pickup` | Soft mechanical pickup tick |
| `item.drop` | Soft mechanical release tick |
| `item.placement.correct` | Quiet positive confirmation tone |
| `item.placement.invalid` | Distinct quiet error tone |
| `collection.completed` | Brief completion motif |
| `puzzle.discovered` | Brief discovery motif |
| `puzzle.completed` | Brief resolution motif |
| `skill.unlocked` | Short unlock motif |
| `skill.activated` | Short activation motif |
| `machinery.stage.changed` | Restrained rising stage cue |
| `invention.assembled` | Restrained assembly cue |
| `invention.activated` | Clearest, still brief resolution cue |

Playback is opt-in through the **Sound effects** Settings control. The version 1 preferences record adds `soundEffectsEnabled`, defaulting to `false`; older records preserve their text-scale and reduced-motion settings and receive the new default. Preferences are stored outside autosaves, backups, imports, and the game-save schema. AudioContext creation or resume is attempted only after a trusted pointer or keyboard gesture while effects are enabled. Events received while muted or suspended are discarded without queueing or later replay. Playback bounds duration, gain, simultaneous voices, and repeated-event rate; turning effects off stops active cues, and teardown removes the subscription and closes the context. Unsupported Web Audio and context/playback failures are isolated from gameplay and can be retried after a later gesture.

When sound effects are enabled, Settings also offers **Preview sound**. The action uses a short internal cue through the same gesture-based unlock and playback safeguards. It is not a gameplay event, is not part of `GAME_AUDIO_EVENT_TYPES`, and does not change progression or game saves. The control is disabled while effects are off and its live status reports whether the preview played.

| Target | Grid | Capacity |
| --- | --- | ---: |
| Harmonic Calibration folio | 4 × 2 | 8 |
| Blueprint cabinet | 6 × 6 | 36 |
| Field-note drawer | 6 × 7 | 40 |
| Clockwork parts bin | 6 × 7 | 40 |
| Experiment archive | 6 × 7 | 40 |
| Bell Before Dawn Case | 4 × 2 | 8 |
| Meridian Survey Case | 4 × 2 | 8 |
| Parallax Trial Case | 4 × 2 | 8 |
| Each scratch pad | 5 × 5 base; 5 × 6 with Modular Worktables | 24 / 30 |

The three chapter cases are at (2940, 340), (3630, 340), and (4320, 340); each is 420 × 300. Slots are contained within destination and scratch-pad surfaces. The workspace retains its 78px visual minimum; filed items use their canonical item height so rendered bounds fit slot geometry. Filed items render at 0°; returning an item to the workspace restores trusted content rotation.

Both scratch pads retain their 540 × 530 world-space footprint. The passive,
one-point **Modular Worktables** skill derives six additional contained slots
per pad; the first 24 slot indices and positions remain unchanged. The app uses
the same derived pad definitions for placement, Inspector moves, world
rendering/navigation, and persistence. Pad headings and accessible names report
current occupancy and capacity.

## Progress and persistence

The first chapter's eight-card Harmonic Calibration collection grants one skill point and unlocks its pulse-sequence puzzle once. The Resonance Lens briefly highlights other members of the selected item's collection, or items of the same family when the selection is not in a collection. It does not move or file items. The relation IDs are shared by the detail DOM renderer and Canvas overview, which paints a high-contrast star marker rotated with each matched card. Detail cards carry an accessible source label, while Canvas-only highlighted titles are exposed in a screen-reader-only list. A single polite activation message names the focused item and match count; activation leaves item state and autosave unchanged. These cues preserve the Canvas renderer and its 64-total DOM overlay cap.

The second chapter adds three eight-item collections: **The Bell Before Dawn**, **Meridian Survey**, and **Parallax Trials**. Each contains two handwritten notes, two experiment records, two map fragments, and two formula cards, has a dedicated eight-slot destination, and grants one skill point once. The **Missing Member Compass** costs one point and highlights one loose member of the selected chapter collection; it does not move, file, or validate items. Completing all three collections unlocks **Chronology of the Last Bell**. Solving the dated sequence adds a notebook discovery and advances the Palimpsest Engine to **Chronology Wheel**.

Collection completion rewards are permanent milestones: `progress.completedCollectionIds`, earned skill points, and `unlockedPuzzleIds` remain after a player moves an item out of a rewarded collection. Current collection completion, destination badges, Notebook placement summaries, the App chapter count, and full-restoration eligibility derive from the items' actual current placements. The Notebook labels a moved-but-rewarded collection **Reward earned; refiling needed**. `InventionCore.completedCollections` remains a boolean assembly-stage fallback tied to earned history; puzzle access and solve prerequisites use earned collection markers and unlocked puzzle IDs. V3 normalization accepts moved members when the earned marker exists, while still rejecting a fully filed collection without its marker or a chronology unlock without every required earned marker. This preserves strict validation without changing the save schema or ending conditions.

`src/ui/InventionCore.jsx` renders the Engine's current stage with repo-native React/CSS: Dormant shows the brass frame and dim, empty lens; Memory Crystal adds a faceted illuminated crystal; Chronology Wheel retains that crystal and adds a toothed, spoked wheel. Stage labels and descriptions remain readable, decorative parts are hidden from assistive technology, and wheel motion respects saved and OS reduced-motion preferences. The Engine's viewport-culling AABB passes its top-left coordinate (`center - half dimensions`) and full width/height to `isNearViewport()`; `.invention-anchor` positioning continues to use the Engine center. Stage visuals do not alter progression, entity count, or v3 save data.

The final restoration state is derived in `src/game/domain/completion.js`: every ID in the frozen current 174-item catalog must be present, validated correct, and filed at its canonical destination; every collection must be complete from actual member placement; and every catalogued puzzle must be solved. `getCompletionStats` derives item, collection, puzzle, notebook, and owned-skill counts from current state. Missing expected item IDs block completion and remain in the item total as unrestored. Stale `completedCollectionIds` entries do not establish collection completion. The final Engine presentation is not persisted as a save flag and adds no save-schema fields.

When those conditions hold, the accessible completion presentation shows an evidence-bounded Engine replay, congratulations, the derived statistics, and **Continue exploring**. The ending describes the Engine as a witness and recorder and identifies the Professor and Elian as witnesses. The strongest reading of the Unsent Apology is that the Professor chose to follow the first stable impression by ordering an eastward survey toward the sealed bell chamber. Later records place that investigation before the bell, but do not establish that his choice caused the Chaos Event. The original Event trigger and Elian's response remain unresolved.

The canonical save schema is v3, compressed with LZ-String in localStorage. V3 strictly validates item IDs, placement targets, slot positions, dimensions, world bounds, capacities, collection completion, and chronology prerequisites. `Modular Worktables` ownership is stored in the existing `progress.ownedSkills` list and does not change the v3 schema. V3 normalization derives scratch-pad capacity from validated ownership before checking placements: slots 24–29 and up to 30 occupants are valid only while the skill is owned. Without the skill, the original 24-slot limit applies. V1 and v2 saves remain supported and continue to use their existing legacy skill-ID whitelist, so migration cannot introduce `modular-worktables`; existing slots and placements are preserved under the old capacity. V1 placement migration preserves its slot-allocation and overflow-salvage behavior; v2 migration preserves supported existing item records and placements, progress, notebook, camera, optional selected item and content seed, and invention stage. Both legacy versions append the 24 authored chapter items exactly once. The v3 item limit is 5,024. A valid raw v1/v2 autosave is preserved in recovery before replacement. Imports migrate and validate before backup or apply; rejected imports leave live state and stored saves unchanged.

When a chapter collection has been rewarded, moving a member preserves its `completedCollectionIds` entry, skill point, and any earned puzzle unlock across v3 normalization and autosave/reload. UI counts and placement status remain derived from current items: destination badges, Notebook completion/summary, and the App header can show an incomplete collection even though its reward remains earned. Chronology availability and solving use earned prerequisite markers, whereas full restoration still requires every item and collection to be currently complete.

**Aether Wayfinder** ownership uses the existing v3 `progress.ownedSkills`
field and current skill catalog; the schema remains v3 and the v1/v2 legacy
skill whitelist is unchanged. Its active timer and guided item/destination
presentation are transient app state and are excluded from game saves,
imports, and autosaves.

The Save & Restore dialog provides three fixed browser-local manual save slots. Each new slot record is a version 1 metadata envelope containing its slot ID, ISO save time, and the existing compressed v3 payload; this does not change the game-save schema. Slot 1 reuses `MANUAL_SAVE_KEY`; an existing raw compressed value there is recognized as a legacy save with an unknown timestamp and is not rewritten until confirmed overwrite. Saving into an empty slot is immediate; overwriting and deletion require confirmation. Restore also requires confirmation, validates through the existing import path, and writes the current state to `BACKUP_SAVE_KEY` before applying the slot. A validation or backup failure leaves the current game and slot unchanged. A corrupt slot is isolated from its neighbors, and browser storage failures are reported without changing live progress. Successful restore follows the existing import and autosave behavior.

Settings, Save & Restore, and the completion presentation share the focus-containment behavior in `src/ui/modalFocus.js`. Tab from outside an open dialog recovers focus to its first control; Shift+Tab recovers to its last. Opening an overwrite, delete, or restore confirmation moves focus to its first available action, and cancelling or completing the action returns focus to the corresponding save control. Each dialog retains its existing initial-focus and Escape behavior.

Accessibility preferences are stored separately from game saves under a versioned key by `src/game/preferences/preferences.js`. Text scale uses a browser-relative 100% root baseline with 100%, 112.5%, 125%, 150%, 175%, and 200% multipliers. Compact layouts support 200% text in Settings, the fresh world, and the single-item Inspector. Effective reduced motion combines the user's optional Always reduce motion preference with the operating system's `prefers-reduced-motion`; the user option can add reduction but cannot override the OS. Preferences do not change autosaves, backups, imports, or the game save schema.

The Wayfinder marker remains visible and accessible when either the saved
reduced-motion setting or OS preference suppresses its highlight animation.

## Accessibility, appearance, and known risks

The visual system uses low-frequency texture and distinct item-family silhouettes as well as color. Invalid placement has text/shape cues, focus indicators have high contrast, reduced-motion preferences suppress decorative motion, and essential movement is available through keyboard-accessible controls.

At widths up to 360px, the four default header actions use a 3px gap and 6px inline control padding so their navigation content fits a 320px viewport at default text. Larger-text scrolling and focus behavior, and header layouts above 360px, remain unchanged.

Compact filed notes show their complete title in a reveal on hover, keyboard focus, or selection. The reveal stays within an 8px inset of the laboratory viewport and adjusts its placement to camera zoom and text scale. It remains transient and does not change item or save geometry.

The completion presentation is a keyboard-operable modal with focus moved to its heading, a live congratulations status, and a **Continue exploring** button. Tab and Shift+Tab recover focus to its boundary controls if focus leaves the dialog; Escape does not dismiss the ending. After gameplay completion through a group Inspector move clears selection, Continue returns focus to the persistent `multi-selection-toggle`. After restoring a completed manual slot, Continue returns focus to `open-saves`. The focused completion and manual-slot restoration checks passed 2/2; the Vite build passed with 62 modules, and scoped review found no actionable issues. In default motion, the decorative `aria-hidden` projection runs a one-shot outer-ring rotation (2.7s), trace formation (1.35s), and core activation (650ms delay followed by 760ms); all three settle, and rerenders do not restart them. Reopening may remount the projection and replay the activation. Reduced-motion mode disables all three animations and retains the fully drawn static trace. This visual-only effect does not change save data, progression, audio, or story text.

Known limitations:

- Browser performance has been measured on one Windows/Edge host at 174–5,024 items. The hybrid overview benchmark represented all entities on Canvas and mounted 64 ordinary DOM overlays in full-world views; matching 5,024-item pan/wheel p95 values were 0.998x/0.996x the 174-item values with no over-50 ms intervals or long tasks. The renderer interaction gate passes on this host; do not generalize these timings to other devices. The independent human playthrough remains required before expanding content. See the [hybrid overview report](performance/2026-11-03-hybrid-canvas-overview.md) and the earlier distinct clustered, distributed, and frame-bounded reports under `docs/performance/`.
- The static survey-floor treatment uses radial rings and broad panel seams on the existing hidden, non-interactive world-ground layer. It follows the camera and sits below Canvas and card content; it adds no world entities or saved state. The separate 2026-11-03 verification run retained the full-world interaction result but observed dense starting-view wheel p95 of 50.1 ms at 5,024 entities, with isolated intervals over 50 ms in 2/3 trials. See the [floor-treatment report](performance/2026-11-03-world-ground-treatment.md); the independent human playthrough and audio quality check remain open.

## Index and generation microbenchmark

A Node microbenchmark used seven trials and reports median generation, index-build, and per-query times. Each trial queried 100 times using a 320px grid and viewport `{x: 800, y: 350, width: 1500, height: 1000}`.

| Entities | Generation (ms) | Index build (ms) | Query (ms) | Results per query |
| ---: | ---: | ---: | ---: | ---: |
| 150 | 0.268 | 0.162 | 0.039 | 110 |
| 500 | 0.274 | 0.330 | 0.164 | 350 |
| 1,000 | 0.510 | 0.661 | 0.334 | 704 |
| 2,500 | 1.182 | 1.641 | 0.740 | 1,786 |
| 5,000 | 2.207 | 3.529 | 1.538 | 3,589 |

These are Node data-generation and index timings only. They do not measure browser rendering, frame rate, dragging, or panning. At 5,000 entities the query returns about 72% of all items. Browser performance has been measured separately; see the history and latest interaction-gate result below.

A separate single-run generation diagnostic for 5,000 items took 1,564 ms before the placement-attempt cap and 5 ms after it. This is a one-off diagnostic, not a benchmark, and should not be compared with the seven-trial table above.

## Browser scaling measurement

The original serial Edge benchmark remains the **clustered-fixture baseline**: at 5,024 items it reached 4,029.3 ms starting-view readiness, mounted 5,000 items, and had 1,383.4/1,899.9 ms pan/wheel p95 intervals. Its tables and methodology remain in [`docs/performance/2026-11-03-browser-scaling.md`](performance/2026-11-03-browser-scaling.md).

The post-serialization retest used a distinct distributed synthetic-tail fixture and is not a same-fixture before/after comparison. Starting readiness was 448.3 ms at 174 and 534.7 ms at 5,024 (1.19x), with mounted counts of 150/174 (86.2%) and 330/5,024 (6.6%). The eight-item sparse view was 155.2/202.2 ms with eight mounted at both sizes. The full-world view mounted all entities and took 204.7/2,633.1 ms; at 5,024, pan/wheel p95 was 1,266.7/850 ms, with 90%/67% intervals over 50 ms and 23/1 long tasks. Serialization left `_compress` out of pan, wheel, drag, and autosave profiles, but the full-world renderer costs remained high in that run. At that time, content expansion remained NO-GO until React work during pan/wheel was reduced while preserving transform, hit-testing, drag, zoom, and save behavior. The same-host follow-up gate was full-world pan/wheel p95 at most 2x the matching 174-item baseline, with no repeatable interaction task over 50 ms. The subsequent hybrid result is below. See the distinct [distributed-fixture retest report](performance/2026-11-03-browser-scaling-distributed-retest.md) for that milestone's details.

The frame-bounded camera/culling retest was a distinct run from both reports above. Start readiness was 447.8 ms at 174 and 528.5 ms at 5,024; starting mounts were 150/174 and 330/5,024, while the sparse view mounted eight and full-world view mounted all items. Full-world pan/wheel p95 was 50/50 ms at 174 and 1,316.6/1,283.3 ms at 5,024 (26.33x/25.67x). At 5,024, 83.87%/60% of intervals exceeded 50 ms, with 23/2 long tasks. The 2x p95 and no-repeatable-task-over-50-ms requirements failed at that milestone. See [`docs/performance/2026-11-03-frame-bounded-camera-culling.md`](performance/2026-11-03-frame-bounded-camera-culling.md).

The hybrid Canvas overview retest is a separate distributed-fixture run. In full-world view it represented all items on Canvas and mounted 64 ordinary DOM overlays at all five sizes. Median first-interactive time rose from 241.5 ms at 174 to 414.7 ms at 5,024. Full-world p95 pan/wheel at 174 was 16.73/16.80 ms; at 5,024 it was 16.70/16.73 ms (0.998x/0.996x). All measured full-world pan/wheel intervals and long tasks stayed at or below 50 ms. The interaction gate passes on this host; the separate human playthrough is still open. See [`docs/performance/2026-11-03-hybrid-canvas-overview.md`](performance/2026-11-03-hybrid-canvas-overview.md).

## Verification and role coverage

Second-chapter milestone verification on 2026-11-03:

- `npm run test:game`: 41/41 passed.
- `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js e2e/lab/organising-loop.spec.js`: 4/4 passed.
- `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js`: 20/20 passed.
- `npm run build`: passed with Vite 8.3.5.
- `npm run test:e2e:performance -- --workers=1`: 2/2 structural cases passed at 174 and 5,024 items during the chapter milestone.
- Original clustered-fixture `npm run test:perf`: build and benchmark passed 1/1; its NO-GO result is detailed in the baseline performance report.
- Serialization optimization: coordinator unit checks 11/11; focused recovery E2E 21/21; structural regressions 3/3; profiler 1/1; distributed-fixture benchmark/build 1/1 in 4.5 minutes. See the dated performance report for the separate clustered baseline and distributed retest.
- Frame-bounded camera/culling: build passed; complete opt-in regression group passed 7/7 in 32.2 seconds; benchmark/build 1/1 in 4.7 minutes. Code review was clear. The performance gate failed as summarized above; the full suite was not run.
- Hybrid Canvas overview: render-policy/hit-test unit tests 5/5; focused browser regressions 7/7; full opt-in performance E2E 12/12 in 44.9 seconds; production build and serial benchmark passed 1/1 in 1.9 minutes; Code Reviewer found no actionable issues. The same-host full-world interaction gate passes; the full test suite was not run. See the hybrid overview report.
- Full-restoration ending: completion unit tests 6/6; focused ending E2E 4/4, including misfiled-item, incomplete-collection, and unsolved-puzzle states; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The full test suite was not run.
- Professor recording-choice ending follow-up (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js` passed 5/5; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The test suite was not run. Its specific recording-through-an-unstable-echo claim is superseded by the 2026-11-04 evidence-bounds correction below.
- Ending evidence-bounds correction (2026-11-04): the focused full-restoration ending E2E passed 13/13 after an initial sandbox `spawn EPERM` retry with process access. It now requires the ending to state only that the Unsent Apology shows the Professor feared Elian would blame the machine for an unnamed choice, without asserting what the choice was or how it related to the Chaos Event. The Engine remains a witness/recorder, Professor and Elian remain witnesses, the original trigger remains unknown, and Elian's response remains unresolved. Scoped Code Reviewer found no actionable findings. No build or full suite was run. See the [archived plan](archive/plans/2026-11-04-ending-evidence-bounds.md).
- Invention stage assembly visuals (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js e2e/lab/organising-loop.spec.js` passed 8/8, including Dormant, partial viewport overlap, Chronology Wheel crystal/wheel rendering and reduced motion, plus migration and puzzle progression. `npm run build` passed with Vite 8.3.5; Code Reviewer re-review found no actionable issues. The full suite was not run and the independent human playthrough remains open.
- Responsive Engine jump (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js` passed 7/7, including centered 100% framing on desktop and fitted, fully visible framing at 390 × 480. `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The full suite and independent human playthrough were not run.
- Accessible multi-selection and atomic batch movement (2026-11-03): `node --test --test-isolation=none tests/unit/game-foundation/game-systems.test.mjs` passed 49/49; `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js` passed 9/9; `npm run build` passed with Vite 8.3.5. Coverage includes staged unique slots and atomic rejection, accessible 40-item selection under the 64-total Canvas overlay cap, independent item validation, final-state progression/events once, and unchanged saves. Code Reviewer found no actionable issues. The full suite and independent human playthrough were not run.
- First-session usability refinement: generator unit tests 46/46; focused Inspector E2E 2/2 at 1084 × 827 and 390 × 480; layout overlap reduced from 259 pairs to 1 with no fully occluded items; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The full test suite was not run. The independent two-chapter human playthrough remains open.
- Asset-free audio event hooks: unit tests 6/6; focused E2E 33/33 across the organising, save-recovery, research, and ending flows; `npm run build` passed with Vite 8.3.5; Code Reviewer found no remaining actionable issues. The full test suite was not run. The separate human-playthrough/content-expansion gate remains active.
- Persistent accessibility preferences: unit tests 9/9; the initial preferences E2E passed 5/5, including 125% root/body font sizing, 390 × 480 layout, and live OS reduced-motion changes; `npm run build` passed with Vite 8.3.5. The later 150% scale extension was verified across Settings, compact toolbar, and header layouts; see the [150% text-scale plan](archive/plans/2026-11-04-150-percent-text-scale.md). Code Reviewer found no remaining issues. The full test suite was not run.
- Optional audio playback: the Web Audio adapter and version 1 preferences compatibility unit command passed 19/19; focused audio, preferences, and manual-save browser tests passed 9/9; `npm run build` passed with Vite 8.3.5; Reviewer re-review found no actionable issues. Automated checks verify event-to-cue wiring and gesture gating; a human listening-quality check remains part of broader release polish. The full test suite was not run.
- Settings audio preview (2026-11-03): adapter unit tests passed 12/12; `npx playwright test e2e/lab/audio-settings.spec.js --workers=1` passed 4/4; `npm run build` passed with Vite 8.3.5; Code Reviewer re-review found no actionable findings. The full test suite was not run; human listening-quality review remains open.
- Modular Worktables: `npm run test:game` passed 55/55; `npm run test:e2e -- --workers=1 e2e/lab/scratch-pad-capacity.spec.js e2e/lab/organising-loop.spec.js` passed 12/12; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The full test suite was not run. Independent human playtesting and content expansion remain gated.
- Mobile world toolbar (2026-11-03): `npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js` passed 3/3 at 390 × 480, 320 × 480, and 1440 × 900. Coverage checks toolbar/control bounds and wrapping, the 154px location selector, selection feedback, and non-overlap among toolbar, hint, and toast. `npm run build` passed; final review found no actionable issues. The full suite was not run.
- Aether Wayfinder (2026-11-03): focused Wayfinder E2E passed 12/12; panel-coordination E2E passed 8/8; the named game-systems unit check passed 2/2; `npm run build` passed with Vite 8.3.5. Final review found no actionable findings. Tests cover non-mutating activation, workspace/scratch-pad/misfiled eligibility, seven-second guide and cleanup, destination focus and low-zoom readability, accessible item-and-destination naming/status, and OS/user reduced-motion behavior. The full test suite was not run; the independent human-playtest/content-expansion gate remains open.
- World target focus accessible names (2026-11-05): `e2e/lab/world-target-focus-accessibility.spec.js` passed 1/1. It verifies exact unique names for eight destinations and two scratch pads, preserves the visible phrases for speech input/Label in Name, and confirms distant destination and scratch-pad controls still recenter their targets. `npm run build` passed with Vite 8.3.5 (62 modules); final review found no remaining issues. Scoped diff check emitted only LF-to-CRLF notices.
- Generic destination focus action label (2026-11-05): the same focused spec passed 1/1 after destination buttons changed their visible copy from **Focus cabinet** to **Focus**, with accessible names `Focus ${destination.label}`. Scratch-pad labels and names remain unchanged. Destination headings and target recentering remain intact; camera persistence continues through `handleCameraChange`, while placement, progression, and save schema are unchanged. The Vite build passed with 62 modules, and final scoped review found no actionable issues.
- Touch pinch navigation (2026-11-03): `node --test --test-isolation=none --test-name-pattern="pinch zoom" tests/unit/game-foundation/camera-pinch.test.mjs` passed 4/4; the touch-navigation E2E passed 7/7, including resize-during-pan cancellation; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. Browser coverage verifies empty-space pan, moving-midpoint pinch anchoring, lift-to-pan, item-drag cancellation without placement change, resize cancellation, and separate pan and pinch autosave/reload. The full suite was not run. The user deferred the independent human playtest for now; its gate remains open and content expansion remains gated.
- Resonance Lens highlight polish (2026-11-03): `node --test --test-isolation=none tests/unit/game-foundation/skill-highlights.test.mjs` passed 2/2; `npm run test:e2e -- --workers=1 e2e/lab/resonance-lens-highlights.spec.js e2e/lab/research-chapter.spec.js --grep "Lens|v2 migration preserves"` passed 3/3; `npm run build` passed with Vite 8.3.5. Verification covers Canvas-only screen-reader titles, a rotated Canvas highlight marker, the single Lens live announcement with item/match count, Compass journey continuity, and saved item/state immutability. Code review and re-review found no actionable findings. The full suite was not run; the independent human-playtest/content-expansion gate remains open. See the [archived plan](archive/plans/2026-11-03-resonance-lens-highlight-polish.md).
- Camera-only render and overview redraw optimization (2026-11-03): focused unit checks passed 11/11 and organizing/highlight browser checks passed 22/22. `npm run test:perf` built with Vite 8.3.5 (56 modules) and passed 1/1. Starting-view wheel p95 was 33.4/49.9/33.3 ms at 174 items with no interval over 50 ms; at 5,024 items it was 50/50.1/50 ms with one over-50 ms interval in one trial and no over-50 ms long tasks. Full-world 5,024-item wheel p95 was 16.8/16.8/16.7 ms with no over-50 ms interval. `npx playwright test --config=playwright.benchmark.config.js` passed 1/1 after a reviewer guard fix. Across 15 measured full-world views (five sizes by three trials), mode stayed overview before and after camera-only zoom, `clearRect` delta was zero, the 64-card overlay cap held, and all Canvas entities were represented. The original red baseline showed three clears on a camera-only wheel zoom. Reviewer found no source-level issues; the low-severity test guard finding was fixed and rerun green. The full suite was not run; the independent human-playtest/content-expansion gate remains open. See the [archived plan](archive/plans/2026-11-03-dense-starting-view-responsiveness.md).
- Dense starting-view render threshold (2026-11-03): render-policy unit tests passed 3/3; opt-in performance E2E passed 12/12; the Vite 8.3.5 build and serial five-size benchmark passed, with the benchmark completing 1/1 in 1.9 minutes. The 256/192 visible-item hysteresis keeps the 174-item view in detail and paints the dense 5,024-item start on Canvas with 64 overlays. Its measured start-view wheel p95 was 16.8/16.7/16.8 ms, with no measured interval or long task above 50 ms. Code Reviewer found no actionable findings; `git diff --check` was clean. The full suite was not run, and the independent human-playtest/content-expansion gate remains open. See the [dated performance report](performance/2026-11-03-dense-start-render-threshold.md) and [archived plan](archive/plans/2026-11-03-dense-starting-view-render-threshold.md).
- Chapter completion reload preservation (2026-11-03): normalization tests passed 3/3, completion unit tests passed 6/6, and the focused research-chapter E2E passed 1/1, including visible Notebook reward/refiling status and autosave/reload preservation of the moved item and earned milestones. `npm run build` passed with Vite 8.3.5 (59 modules); Code Reviewer found no remaining issues and `git diff --check` was clean. Red baselines caught both incorrect current chapter counts after refiling and the Notebook status appearing only in its accessible name, not visible row text. The full suite was not run. See the [archived plan](archive/plans/2026-11-03-chapter-completion-reload-preservation.md).
- Zoom announcement accessibility (2026-11-03): focused zoom-announcement E2E passed 8/8, including wheel coalescing, toolbar/pinch settlement, initial and pan silence, a >220 ms active-pinch pause, continuation-pan silence, and Escape rollback without duplicate status. Existing research and touch-navigation E2E passed 14/14; the Vite 8.3.5 production build passed; Reviewer re-review found no actionable findings; scoped `git diff --check` was clean. The full suite was not run. The red staged-pinch baseline recorded an intermediate `23%` while both fingers were still down; the rollback case passed 1/1. See the [archived plan](archive/plans/2026-11-03-zoom-announcement-debounce.md).
- Item Finder announcement polish (2026-11-03): focused Finder announcement E2E passed 4/4; panel-coordination E2E passed 8/8; the Vite production build passed; Code Reviewer found no actionable findings and scoped `git diff --check` was clean. Visible query filtering and page navigation remain immediate. The one polite status announces settled query/clear count plus page, and page changes announce combined page/count while cancelling any pending query timer. The race red baseline showed `Page 2 of 7.` overwritten by `174 matching items.` after 350 ms; the final regression requires one `Page 2 of 7. 174 matching items.` status. The full suite was not run. See the [archived plan](archive/plans/2026-11-03-item-finder-announcement-polish.md).
- Compact panel exclusivity (2026-11-03): the five new compact-panel cases passed 5/5 and the full panel-coordination E2E passed 13/13. They cover compact selection/manual panel changes, desktop coexistence and resize, both collection-completion outcomes, and usable Inspector Move controls at 390 × 480. The Vite production build passed; Code Reviewer found no actionable findings and the scoped diff-check was clean apart from expected CRLF conversion warnings. The full suite was not run. See the [archived plan](archive/plans/2026-11-03-compact-panel-exclusivity.md).
- Compact Clockwork Atlas coordination (2026-11-03): focused Atlas regressions passed 3/3; combined `world-atlas.spec.js` and `panel-coordination.spec.js` passed 27/27. The desktop-resize case verifies Atlas map focus before resizing and focus returning to the Atlas toggle when Atlas held focus. The Vite production build passed; Code Reviewer confirmed both findings resolved with no remaining issues. Scoped diff-check was clean aside from expected LF-to-CRLF conversion warnings. The full suite was not run. See the [archived plan](archive/plans/2026-11-03-compact-atlas-exclusivity.md).
- Compact Finder/side-panel coordination (2026-11-03): focused regressions passed 4/4; combined panel-coordination, Atlas, and Item Finder announcement E2E passed 35/35. Coverage verifies compact Finder/Notebook transitions, desktop coexistence, existing Inspector/Finder and Atlas/Finder behavior, and resize closure with conditional focus return. The production build passed; Code Reviewer found no issues; scoped diff-check was clean aside from expected line-ending warnings. The full suite was not run. See the [archived plan](archive/plans/2026-11-03-compact-finder-exclusivity.md).
- Inspector and Puzzle close focus return (2026-11-03): the three focused cases passed 3/3; relevant `filed-note-title.spec.js`, `organising-loop.spec.js`, and `panel-coordination.spec.js` passed 40/40. Closing Inspector restores focus to the selected item; for groups it prefers the current selection and implements a first-selected-ID fallback. Closing Puzzle restores focus to the persistent Open Puzzle control. At that time, the fallback was not directly regression-tested. The build passed; Reviewer found no issues; scoped diff-check was clean aside from LF-to-CRLF warnings. The full suite was not run. See the [archived plan](archive/plans/2026-11-03-panel-close-focus-return.md).
- Inspector focus fallback follow-up (2026-11-03): the disabled-current-item group regression verifies that focus continues to the first selected item and both items remain selected. The focused selected-item, Puzzle, and fallback checks passed 3/3; the production build passed; Code Reviewer found no functional issue; scoped diff-check was clean aside from the expected LF-to-CRLF warning. The full suite was not run. See the [archived plan](archive/plans/2026-11-03-inspector-focus-fallback.md).
- Puzzle focus on open (2026-11-05): focused collection-unlock E2E passed 2/2 for single-item and group Inspector moves, confirming focus on the first puzzle choice and Enter activation. The solved Chronology puzzle reopen path passed 1/1 with heading focus as the no-choice fallback. The Vite 8.3.5 build passed with 62 modules; Code Reviewer re-review found no actionable findings. The full suite was not run. See the [archived plan](archive/plans/2026-11-05-puzzle-panel-focus-after-unlock.md).
- Reviewer re-review found no remaining blockers.
- The full test suite was not run.

The browser harness and exact commands are documented in `docs/TESTING_GUIDE.md`. The independent human playthrough remains follow-up work. The agent-led exploratory session is documented separately and did not complete either chapter.

Available roles are Architect, Documentation Specialist, Test Engineer, JavaScript Developer, React Developer, CSS Developer, and Code Reviewer. There is no dedicated game-design, narrative, performance, accessibility, or playtesting role; assign those reviews to the closest available roles and record their scope.

