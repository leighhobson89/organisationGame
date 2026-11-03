# Exploratory Playtest: Research Chapters

**Date:** 2026-11-03  
**Session type:** Agent-led exploratory session using CUA; not independent human feedback  
**Status:** The latest cumulative agent-led fresh-origin run completed all four current collections and both chapter puzzles, but it is not independent human feedback. Its manual reload after the chronology puzzle was not verified; a separate focused E2E now verifies the chronology save/reload round-trip. The full-restoration ending was not reached, and the independent human-playthrough/content-expansion gate remains open.

## Environment

- Fresh Chrome Incognito session at Vite `http://127.0.0.1:5173`
- 174 items
- Window sizes observed: 1084 by 827 and 1920 by 1080

## Observations

- Manually misfiled Harmonic Calibration 01, recovered it, then moved it to the Analysis Table. The temporary-item count showed 1 during the move, and reloading preserved the item's placement.
- The jump selector focused the Analysis Table and displayed both work surfaces.
- At 1084 by 827, the inspector's Move button was below the fold and required scrolling the panel. At 1920 by 1080, the button fit without panel scrolling.
- Generated filler items appeared heavily overlapped in clusters toward the right and bottom of the world. The authored calibration cards appeared distinct.
- One CUA pointer-drag attempt did not file the item. The result is inconclusive because of uncertainty about pointer coordinates and tool behavior. The separate Playwright drag regression passed at both 174 and 5,024 items.

### Follow-up CUA session

- Fresh Chrome Incognito session using Vite at `http://127.0.0.1:5174`.
- Completed the first Harmonic Calibration collection by selecting all eight authored cards through each card's Inspector destination selector. Every card showed “Filed correctly,” and the collection reached 8/8.
- The First Resonance puzzle unlocked automatically. Solving `gear → diamond → circle → star` produced the Memory Crystal and a notebook discovery.
- Earned one skill point, built and activated the Resonance Lens, then selected a calibration card. A toast said the lens had cooled, but the highlight effect was not clearly verified.
- One pointer-drag attempt panned empty space instead of filing a card. Because the pointer coordinates were uncertain, this remains inconclusive and is not evidence of a defect.
- Did not complete either chapter-two collection, use the Missing Member Compass, complete chronology, test keyboard movement, or save/reload.

### Fresh-origin CUA session

- Used a fresh Chrome Incognito origin at `http://127.0.0.1:5175`, Vite 8.3.5, and a 1920 × 1080 window. The previous 5174 tab was stale and was left untouched. Slot 1 held the new origin's 0% baseline before play began.
- Settings showed Sound effects off by default. They were left off; this session did not assess human listening quality.
- Restored all eight **The Bell Before Dawn** records through the Inspector. The case reached 8/8, its notebook discovery appeared, Research collections advanced to 1 of 3, and one insight point was awarded. The notebook opened on completion.
- Built the **Missing Member Compass**, selected **Survey Instructions: 13 October**, and activated it. The message and visual highlight pointed to **A Patient Correction**; the item remained loose.
- Dragged **Survey Instructions: 13 October** into **Meridian Survey Case**. The Inspector showed it in the correct case and the case reached 1/8.
- Tested view navigation: the zoom button changed 72% to 95%; wheel input changed 95% to 107%; dragging empty space panned the laboratory; clicking empty space and pressing Right also panned it.
- Reload preserved the 8/8 Bell collection and 1/8 Meridian placement. Restoring Slot 1 returned the new origin to 0% and reported that the previous progress had been backed up.
- The game actions completed through the Inspector and one pointer drag. CUA clicks on Finder results did not reliably activate them, so visible canvas cards were used instead. Treat this as automation friction, not a confirmed game defect. An off-screen compass build control also required scrolling its panel before coordinate activation.
- This session did not restore Harmonic Calibration, solve First Resonance, complete the remaining two chapter-two collections, use the Resonance Lens, solve chronology, or finish either chapter.

### Fresh-origin panel coordination check

- Opened a fresh Chrome Incognito origin at `http://127.0.0.1:5176`, with no prior save on that origin, at 1920 × 1080.
- Completed Harmonic Calibration and First Resonance, built and activated the Resonance Lens (its highlight effect remained uncertain), and filed one Bell Before Dawn item. This was exploratory progress, not completion of either chapter.
- Opening Find an item while Instruments was open correctly closed Instruments. Selecting a Finder result by pointer closed the Finder and opened the Inspector. Then opening Finder while the Inspector was already visible showed both panels at once; this observation led to the panel-coordination fix.
- The fix was verified by the focused panel-coordination Playwright spec (8/8), a production build, and clear code review. This was not a new full manual playthrough, and the overall human-playthrough gate remains incomplete.

### Latest cumulative fresh-origin chapter run

- Continued the same fresh Chrome Incognito origin at `http://127.0.0.1:5180` across assistant turns. This is a cumulative agent-led CUA run, not an independent human playtest or one uninterrupted session. The browser window was 1920 by 1080; the game contained 174 items.
- Restored Harmonic Calibration, The Bell Before Dawn, Meridian Survey, and Parallax Trials to 8/8. Solved First Resonance (`gear → diamond → circle → star`) and Chronology of the Last Bell in dated order: first stable impression, eastward survey, sealed chamber reading, unattended bell.
- Purchased and used the Missing Member Compass on **Private Entry: 14 October**. It highlighted **Unsent Apology**, which was then filed into Parallax; the tool did not move or file it automatically.
- The notebook recorded **The Last Bell**: the Engine replayed an impression left behind by the bell event rather than causing it, and the Professor was not alone when it happened. The witness record names both the Professor and Elian.
- The run ended with 32 of 174 objects correctly filed (18%), all four authored collections restored, three research collections restored, three skill points, and the Chronology Wheel stage. It did not meet the 174-item full-restoration criteria and did not reach the final Engine ending.
- Saved a manual snapshot to Slot 1 after solving the chronology. The manual CUA post-chronology reload check could not be completed: when a browser reload was invoked, the computer-use tool stopped before acting because it could not confirm the current browser URL. This manual check remains unverified. A separate focused E2E later verified that the completed chronology state survives reload; that automated result does not change what happened in this CUA session or count as human feedback.
- The sound setting remained off, so this session did not assess listening quality.

## Related automated evidence

These checks are separate from the CUA observations above and do not make this a completed manual playthrough:

- **Chronology save/reload follow-up (2026-11-03):** `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js --grep "v2 migration preserves the old placement"` passed 1/1. After the v2-to-v3 migration, three chapter collections, Compass use, and chronology solve, the test reloads the browser and verifies 174 items, all three chapter collections and their correct placements, the migrated item's placement/position/rotation, Compass ownership, chronology puzzle completion, notebook discovery, Chronology Wheel, and unchanged item/progress/notebook/camera state. The notebook panel visibly contains **The Last Bell** after reload. `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. This verifies automated persistence only; the CUA manual reload and independent human playthrough remain open.

- The initial `npm run test:e2e:performance -- --workers=1` passed 2/2 structural/interaction cases at 174 and 5,024 items. They cover exact item counts, populated sparse and full-world mounted counts, pan, wheel zoom, a Playwright drag, and autosaved IDs/placement. The reported 3.4s and 12.6s values are test-run durations, not performance measurements.
- The original clustered-fixture `npm run test:perf` completed the build and passed the serial browser benchmark 1/1 across 174, 500, 1,000, 2,500, and 5,024 items. Its one-host results returned a NO-GO for content expansion with the current renderer; see `docs/performance/2026-11-03-browser-scaling.md` for methodology and trial data.
- The separate post-serialization distributed-fixture retest passed `npm run test:e2e:performance -- --workers=1` 3/3, coordinator tests 11/11, world/save recovery E2E 21/21, `npm run profile:perf` 1/1, and `npm run test:perf` 1/1 in 4.5 minutes. Serialization no longer occupied the main thread in profiled pan, wheel, drag, or autosave flows, but full-world interaction remained poor and content scaling remains NO-GO. Details are in `docs/performance/2026-11-03-browser-scaling-distributed-retest.md`.
- Previous focused E2E runs passed 4/4 for the complete chapter and organizing journeys and 20/20 for world/save recovery.
- **First-session usability follow-up:** the two issues observed in this agent-led session have since been addressed and automated-verified. The 174-item layout went from 259 axis-aligned overlap pairs to 1, with no fully occluded items. Focused Inspector E2E cases passed 2/2 at 1084 × 827 and 390 × 480, checking that Move stays visible before auto-scroll. The full test suite was not run. These fixes do not complete the manual journey or count as independent human feedback.
- **Panel coordination follow-up:** the Finder/Inspector overlap observed at the fresh 5176 origin was fixed and verified by 8/8 focused E2E cases, a passing build, and clear code review. The browser observation was exploratory; the fix was not validated by a new full CUA playthrough and provides no independent human feedback.

## Limits and follow-up

The latest cumulative agent-led fresh-origin run completed both current chapter loops, but it provides no independent human feedback and does not count as an independent playthrough. Its manual post-chronology reload was not verified in that CUA session; the separate focused E2E round-trip passed. The run did not reach the full-restoration ending because only 32 of 174 objects were correctly filed. Earlier partial CUA sessions remain useful for their specific observations; they do not supersede the latest cumulative result.

Keep the independent human-playtesting and content-expansion gate open. A follow-up should review both chapter loops from a fresh save, verify pointer and keyboard movement, puzzle progression, and post-chronology save/reload, and gather independent feedback. Confirm the corrected Inspector visibility and less-overlapped generated layout during that session. Do not treat the inconclusive CUA drags as evidence of a gameplay defect or as successful drag coverage.
