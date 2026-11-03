export const WORLD_BOUNDS = Object.freeze({
  x: 0,
  y: 0,
  width: 5200,
  height: 3400,
});

export const DESTINATIONS = Object.freeze([
  {
    id: 'cabinet-calibration',
    label: 'Harmonic Calibration Folio',
    family: 'blueprint-fragment',
    collectionId: 'harmonic-calibration',
    position: Object.freeze({ x: 540, y: 170 }),
    width: 420,
    height: 300,
    slotCount: 8,
    layout: Object.freeze({ columns: 4, rows: 2, insetX: 20, insetY: 76, cellWidth: 92, cellHeight: 66, gapX: 8, gapY: 8 }),
  },
  {
    id: 'cabinet-blueprints',
    label: 'Blueprint Cabinet',
    family: 'blueprint-fragment',
    position: Object.freeze({ x: 1500, y: 2640 }),
    width: 640,
    height: 660,
    slotCount: 36,
    layout: Object.freeze({ columns: 6, rows: 6, insetX: 20, insetY: 76, cellWidth: 92, cellHeight: 66, gapX: 8, gapY: 8 }),
  },
  {
    id: 'drawer-field-notes',
    label: 'Field Note Drawer',
    family: 'handwritten-note',
    position: Object.freeze({ x: 2180, y: 2640 }),
    width: 640,
    height: 660,
    slotCount: 40,
    layout: Object.freeze({ columns: 6, rows: 7, insetX: 20, insetY: 76, cellWidth: 92, cellHeight: 66, gapX: 8, gapY: 8 }),
  },
  {
    id: 'bin-clockwork',
    label: 'Clockwork Parts Bin',
    family: 'gear',
    position: Object.freeze({ x: 2860, y: 2640 }),
    width: 640,
    height: 660,
    slotCount: 40,
    layout: Object.freeze({ columns: 6, rows: 7, insetX: 20, insetY: 76, cellWidth: 92, cellHeight: 66, gapX: 8, gapY: 8 }),
  },
  {
    id: 'archive-experiments',
    label: 'Experiment Record Archive',
    family: 'experiment-record',
    position: Object.freeze({ x: 3540, y: 2640 }),
    width: 640,
    height: 660,
    slotCount: 40,
    layout: Object.freeze({ columns: 6, rows: 7, insetX: 20, insetY: 76, cellWidth: 92, cellHeight: 66, gapX: 8, gapY: 8 }),
  },
  {
    id: 'case-bell-before-dawn',
    label: 'Bell Before Dawn Case',
    family: 'research-record',
    collectionId: 'bell-before-dawn',
    position: Object.freeze({ x: 2940, y: 340 }),
    width: 420,
    height: 300,
    slotCount: 8,
    layout: Object.freeze({ columns: 4, rows: 2, insetX: 20, insetY: 76, cellWidth: 92, cellHeight: 66, gapX: 8, gapY: 8 }),
  },
  {
    id: 'case-meridian-survey',
    label: 'Meridian Survey Case',
    family: 'research-record',
    collectionId: 'meridian-survey',
    position: Object.freeze({ x: 3630, y: 340 }),
    width: 420,
    height: 300,
    slotCount: 8,
    layout: Object.freeze({ columns: 4, rows: 2, insetX: 20, insetY: 76, cellWidth: 92, cellHeight: 66, gapX: 8, gapY: 8 }),
  },
  {
    id: 'case-parallax-trials',
    label: 'Parallax Trial Case',
    family: 'research-record',
    collectionId: 'parallax-trials',
    position: Object.freeze({ x: 4320, y: 340 }),
    width: 420,
    height: 300,
    slotCount: 8,
    layout: Object.freeze({ columns: 4, rows: 2, insetX: 20, insetY: 76, cellWidth: 92, cellHeight: 66, gapX: 8, gapY: 8 }),
  },
]);

export const SCRATCH_PADS = Object.freeze([
  {
    id: 'scratch-a',
    label: 'Analysis Table',
    position: Object.freeze({ x: 640, y: 1850 }),
    width: 540,
    height: 530,
    capacity: 24,
    layout: Object.freeze({ columns: 5, rows: 5, insetX: 16, insetY: 72, cellWidth: 92, cellHeight: 66, gapX: 8, gapY: 8 }),
  },
  {
    id: 'scratch-b',
    label: 'Comparison Bench',
    position: Object.freeze({ x: 1300, y: 1850 }),
    width: 540,
    height: 530,
    capacity: 24,
    layout: Object.freeze({ columns: 5, rows: 5, insetX: 16, insetY: 72, cellWidth: 92, cellHeight: 66, gapX: 8, gapY: 8 }),
  },
]);

const calibrationItemIds = Object.freeze(
  Array.from({ length: 8 }, (_, index) => `calibration-card-${String(index + 1).padStart(2, '0')}`),
);

const chapterCollectionDefinitions = [
  {
    id: 'bell-before-dawn', label: 'The Bell Before Dawn', destinationId: 'case-bell-before-dawn',
    discoveryId: 'discovery-bell-before-dawn', itemPrefix: 'bell-before-dawn',
    items: [
      { family: 'handwritten-note', title: 'Letter to Elian, 11 October', clue: 'The chamber answered before anyone touched its bell.', mark: 'N' },
      { family: 'handwritten-note', title: 'Margin Note: Keep the Door Open', clue: '“I heard it again after the room was empty.”', mark: 'N' },
      { family: 'experiment-record', title: 'Trial 03: First Stable Impression', clue: 'Dated 12 October. The crystal held an image for eleven seconds.', mark: 'III' },
      { family: 'experiment-record', title: 'Trial 04: The Silent Room', clue: 'Dated 14 October. No one was present when the bell sounded.', mark: 'IV' },
      { family: 'map-fragment', title: 'Observatory Floor, West Rail', clue: 'The western rail was surveyed on 13 October, after the stable trial.', mark: 'W' },
      { family: 'map-fragment', title: 'Bell Chamber Access Sketch', clue: 'The marked route enters from the observatory, not the main workshop.', mark: 'E' },
      { family: 'formula-card', title: 'Residual Duration, Revision A', clue: 'Initialled on 12 October, beside Trial 03.', mark: '12' },
      { family: 'formula-card', title: 'A Note on Unattended Signals', clue: 'A calculation dated 14 October predicts a fourth ring with no operator.', mark: '14' },
    ],
  },
  {
    id: 'meridian-survey', label: 'Meridian Survey', destinationId: 'case-meridian-survey',
    discoveryId: 'discovery-meridian-survey', itemPrefix: 'meridian-survey',
    items: [
      { family: 'handwritten-note', title: 'Survey Instructions: 13 October', clue: 'The Professor orders a bearing check after the first stable impression.', mark: '13' },
      { family: 'handwritten-note', title: 'A Patient Correction', clue: '“North by east” is crossed out; “east by north” is underlined.', mark: 'E' },
      { family: 'experiment-record', title: 'Compass Drift Observation', clue: 'Recorded on 13 October. Every needle leans toward the sealed chamber.', mark: 'III' },
      { family: 'experiment-record', title: 'Night Reading: 14 October', clue: 'The chamber is empty, yet the compass records a fresh pulse.', mark: 'IV' },
      { family: 'map-fragment', title: 'Meridian Grid, Sheet 1', clue: 'The first bearing was copied on 13 October, before the midnight reading.', mark: 'E1' },
      { family: 'map-fragment', title: 'Meridian Grid, Sheet 2', clue: 'A second bearing ends at the locked bell chamber.', mark: 'E2' },
      { family: 'formula-card', title: 'Bearing Correction: 13 October', clue: 'The corrected longitude points east of the observatory by one brass marker.', mark: '13' },
      { family: 'formula-card', title: 'Needle Lag Calculation', clue: 'A lag of four seconds matches the pulse after the chamber was sealed.', mark: '4s' },
    ],
  },
  {
    id: 'parallax-trials', label: 'Parallax Trials', destinationId: 'case-parallax-trials',
    discoveryId: 'discovery-parallax-trials', itemPrefix: 'parallax-trials',
    items: [
      { family: 'handwritten-note', title: 'Private Entry: 14 October', clue: '“I did not ring it. I was still in the east gallery.”', mark: '14' },
      { family: 'handwritten-note', title: 'Unsent Apology', clue: 'The Professor fears Elian will blame the machine for a choice he made.', mark: 'A' },
      { family: 'experiment-record', title: 'Parallax Trial: Second Image', clue: 'The second image appears on 14 October, after the eastward survey.', mark: 'II' },
      { family: 'experiment-record', title: 'Bell Event: 02:17', clue: 'The final log is dated 15 October. A memory forms around the sound.', mark: 'V' },
      { family: 'map-fragment', title: 'East Gallery, Sealed Route', clue: 'A pencil mark places the Professor in the gallery at 02:17.', mark: 'G' },
      { family: 'map-fragment', title: 'Chamber Outline After the Bell', clue: 'The final route is drawn on 15 October, after the chamber opens again.', mark: '15' },
      { family: 'formula-card', title: 'Parallax Estimate: 14 October', clue: 'The second image is displaced by one marker, matching the east gallery line.', mark: '14' },
      { family: 'formula-card', title: 'Two Witnesses, One Impression', clue: 'A final calculation dated 15 October names the Professor and Elian as witnesses.', mark: '15' },
    ],
  },
];

export const CHAPTER_COLLECTION_IDS = Object.freeze(chapterCollectionDefinitions.map((entry) => entry.id));

export const AUTHORED_CHAPTER_ITEMS = Object.freeze(chapterCollectionDefinitions.flatMap((collection) => (
  collection.items.map((item, index) => Object.freeze({
    id: `${collection.itemPrefix}-${String(index + 1).padStart(2, '0')}`,
    collectionId: collection.id,
    correctDestinationId: collection.destinationId,
    authored: true,
    ...item,
  }))
)));

export const COLLECTIONS = Object.freeze([
  {
    id: 'harmonic-calibration',
    label: 'Harmonic Calibration',
    family: 'blueprint-fragment',
    itemIds: calibrationItemIds,
    destinationId: 'cabinet-calibration',
    puzzleId: 'pulse-sequence',
    skillPointReward: 1,
    description: 'Eight tuning diagrams from the Professor’s unfinished resonance trials.',
  },
  ...chapterCollectionDefinitions.map((entry) => Object.freeze({
    id: entry.id,
    label: entry.label,
    family: 'research-record',
    itemIds: Object.freeze(entry.items.map((_, index) => `${entry.itemPrefix}-${String(index + 1).padStart(2, '0')}`)),
    destinationId: entry.destinationId,
    puzzleId: 'chronology-last-bell',
    discoveryId: entry.discoveryId,
    chapter: 2,
    skillPointReward: 1,
    description: `Eight records that reveal another part of the Professor's last week: ${entry.label.toLowerCase()}.`,
  })),
]);

export const PUZZLES = Object.freeze([
  {
    id: 'pulse-sequence',
    title: 'The First Resonance',
    prompt: 'The aligned folio exposes four glyphs. Enter the pulse the Professor marked in the margin.',
    symbols: Object.freeze(['◇', '⚙', '✦', '◉']),
    solution: Object.freeze(['⚙', '◇', '◉', '✦']),
    reward: Object.freeze({ inventionStage: 'Memory Crystal', clueId: 'memory-impression-01' }),
  },
  {
    id: 'chronology-last-bell',
    title: 'Chronology of the Last Bell',
    prompt: 'The records disagree about who rang the bell. Put the dated events in the order the evidence supports.',
    events: Object.freeze([
      Object.freeze({ id: 'stable-impression', label: 'The first stable impression', evidence: 'Trial 03 holds an image on 12 October.' }),
      Object.freeze({ id: 'eastward-survey', label: 'The eastward survey', evidence: 'The meridian correction is recorded on 13 October.' }),
      Object.freeze({ id: 'sealed-chamber-reading', label: 'The sealed chamber reading', evidence: 'A silent-room reading follows on 14 October.' }),
      Object.freeze({ id: 'unattended-bell', label: 'The unattended bell', evidence: 'The final event log is dated 15 October, after the chamber was sealed.' }),
    ]),
    solution: Object.freeze(['stable-impression', 'eastward-survey', 'sealed-chamber-reading', 'unattended-bell']),
    requiresCompletedCollectionIds: CHAPTER_COLLECTION_IDS,
    reward: Object.freeze({ inventionStage: 'Chronology Wheel', clueId: 'discovery-chronology-last-bell' }),
  },
]);

export const SKILLS = Object.freeze([
  {
    id: 'resonance-lens',
    label: 'Resonance Lens',
    cost: 1,
    durationMs: 7000,
    effect: 'highlight-related-items',
    description: "Briefly glimmer other members of the selected item's collection, or items of the same family when it has no collection. It never moves or files them.",
  },
  {
    id: 'missing-member-compass',
    label: 'Missing Member Compass',
    cost: 1,
    effect: 'locate-missing-collection-member',
    description: 'Point to one loose member of the selected chapter collection. You still decide where it belongs.',
  },
  {
    id: 'aether-wayfinder',
    label: 'Aether Wayfinder',
    cost: 2,
    durationMs: 7000,
    effect: 'highlight-correct-destination',
    kind: 'Navigation instrument',
    mark: '⌖',
    purchaseLabel: 'Build Wayfinder · 2 points',
    purchaseConfirmation: 'The Wayfinder is assembled. Select a loose object to trace its destination.',
    activateLabel: 'Trace destination',
    activeLabel: 'Destination traced',
    selectionHint: 'Select a loose or misfiled object first.',
    description: 'Focus its correct cabinet and mark it briefly. You still decide whether and when to file the object.',
  },
  {
    id: 'modular-worktables',
    label: 'Modular Worktables',
    cost: 1,
    effect: 'expand-scratch-pad-capacity',
    passive: true,
    kind: 'Workshop upgrade',
    purchaseLabel: 'Expand tables · 1 point',
    purchaseConfirmation: 'Six more spaces available on each table.',
    ownedStatus: 'Installed · both tables now hold 30 objects',
    description: 'Fit a sixth row of temporary work slots on both tables. Your arrangements remain unvalidated until you file each object.',
  },
]);

export function getScratchPadsForOwnedSkills(ownedSkillIds = []) {
  if (!Array.isArray(ownedSkillIds) || !ownedSkillIds.includes('modular-worktables')) return SCRATCH_PADS;

  return Object.freeze(SCRATCH_PADS.map((pad) => Object.freeze({
    ...pad,
    capacity: 30,
    layout: Object.freeze({ ...pad.layout, rows: 6 }),
  })));
}

export const NOTEBOOK_DISCOVERIES = Object.freeze([
  Object.freeze({ id: 'memory-impression-01', title: 'A Memory in Brass', text: 'The calibration folio leaves a stable impression in the crystal. The Engine can preserve an echo, but the records do not yet explain whose memory it holds.' }),
  Object.freeze({ id: 'discovery-bell-before-dawn', title: 'A Bell Before Dawn', text: 'The bell sounded in an empty chamber. The Professor insists no one rang it, then crosses out the word “insists”.' }),
  Object.freeze({ id: 'discovery-meridian-survey', title: 'The Needle Turns East', text: 'Every corrected bearing leads to the sealed chamber. The survey was made after the first stable image, not before it.' }),
  Object.freeze({ id: 'discovery-parallax-trials', title: 'Two Witnesses', text: 'The final records name both the Professor and Elian as witnesses. The Engine seems to have preserved more than one point of view.' }),
  Object.freeze({ id: 'discovery-chronology-last-bell', title: 'The Last Bell', text: 'The Engine did not cause the bell to ring. It replayed an impression left behind by the event, and the Professor was not alone when it happened.' }),
]);
