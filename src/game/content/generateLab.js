import { AUTHORED_CHAPTER_ITEMS, COLLECTIONS, DESTINATIONS, WORLD_BOUNDS } from './catalog.js';

const AUTHORED_CALIBRATION_COUNT = 8;
export const LEGACY_LAB_ITEM_LIMIT = 5000;
const FRESH_GAME_LEGACY_ITEM_COUNT = 150;
const FILLER_POSITION_CELL_SIZE = 160;
const FILLER_POSITION_ATTEMPTS = 24;
const CALIBRATION_CARD_GRID = Object.freeze({
  x: 980,
  y: 520,
  columns: 4,
  columnStep: 104,
  rowStep: 82,
  width: 88,
  height: 64,
  clearance: 6,
});
const INITIAL_CLUSTER_CENTERS = Object.freeze({
  'blueprint-fragment': [
    { x: 1740, y: 460 },
    { x: 2140, y: 790 },
  ],
  'handwritten-note': [
    { x: 1580, y: 430 },
    { x: 820, y: 1360 },
  ],
  gear: [
    { x: 680, y: 1050 },
    { x: 1940, y: 1310 },
  ],
  'experiment-record': [
    { x: 1480, y: 1260 },
    { x: 2340, y: 1160 },
  ],
});

const FAMILY_CONFIG = Object.freeze([
  {
    family: 'blueprint-fragment',
    idPrefix: 'blueprint-fragment',
    destinationId: 'cabinet-blueprints',
    titles: ['Pressure Valve Plan', 'Aether Conduit Sketch', 'Pendulum Housing Diagram', 'Lens Calibration Draft'],
    clues: [
      'Ink smudges cluster around the lower hinge.',
      'A brass corner tab carries a tiny crescent mark.',
      'The paper smells faintly of lamp oil and ozone.',
      'A pencilled note says: “mind the eastern tooth.”',
    ],
    marks: ['⌁', '◇', '⟐', '△'],
    width: 92,
    height: 66,
  },
  {
    family: 'handwritten-note',
    idPrefix: 'field-note',
    destinationId: 'drawer-field-notes',
    titles: ['Field Note', 'Margin Memorandum', 'Letter Fragment', 'Workshop Reminder'],
    clues: [
      'The Professor underlined the word “again” twice.',
      'A coffee ring hides the date but leaves the signature clear.',
      'The last line trails into a row of gear-shaped doodles.',
      'A wax fleck matches the Professor’s indigo seal.',
    ],
    marks: ['✎', '☾', '✉', '⌕'],
    width: 78,
    height: 58,
  },
  {
    family: 'gear',
    idPrefix: 'clockwork-gear',
    destinationId: 'bin-clockwork',
    titles: ['Brass Cog', 'Copper Ratchet', 'Escapement Wheel', 'Idler Gear'],
    clues: [
      'Its teeth carry a stripe of blue enamel.',
      'The hub is stamped with a small double notch.',
      'A spring-loaded pawl clicks when the gear is turned.',
      'The rim has one deliberately missing tooth.',
    ],
    marks: ['⚙', '✣', '⊙', '⛭'],
    width: 62,
    height: 62,
  },
  {
    family: 'experiment-record',
    idPrefix: 'experiment-record',
    destinationId: 'archive-experiments',
    titles: ['Experiment Log', 'Trial Record', 'Specimen Report', 'Observation Sheet'],
    clues: [
      'The results column is marked with three tiny stars.',
      'A red correction changes “failed” to “not yet”.',
      'The paper edge is singed but the numbers remain legible.',
      'A blue tick marks an observation worth repeating.',
    ],
    marks: ['✶', '☷', '◉', '⌬'],
    width: 86,
    height: 64,
  },
]);

const CALIBRATION_GLYPHS = Object.freeze(['◇', '⚙', '◉', '✦', '⚙', '◇', '✦', '◉']);
const CALIBRATION_CARD_COPY_BY_ID = Object.freeze({
  'calibration-card-01': Object.freeze({ title: 'Carrier Tone Plate', clue: 'Its split-gold calibration seal matches the Harmonic Calibration Folio. This plate records the carrier tone used by the other resonance trials.' }),
  'calibration-card-02': Object.freeze({ title: 'Western Echo Trace', clue: 'The split-gold seal marks this as a Harmonic Calibration plate. Its wave returns from the western rail of the resonance chamber.' }),
  'calibration-card-03': Object.freeze({ title: 'Eastern Echo Trace', clue: 'This matching calibration plate records the paired echo from the eastern rail. Compare its waveform with the western trace.' }),
  'calibration-card-04': Object.freeze({ title: 'Counterphase Sketch', clue: 'A split-gold calibration seal appears beside the counterphase drawing. The note compares it with the carrier tone, not the gear diagrams.' }),
  'calibration-card-05': Object.freeze({ title: 'Crystal Response Diagram', clue: 'This marked resonance diagram records how the memory crystal responds to the chamber pulse. It belongs with the other tuning plates.' }),
  'calibration-card-06': Object.freeze({ title: 'Silent Chamber Trace', clue: 'The chamber appears empty, but a faint resonance remains on this calibration plate. Its split-gold seal matches the Folio.' }),
  'calibration-card-07': Object.freeze({ title: 'Bell-Rail Harmonic', clue: 'A measured tone from the bell rail is stamped with the Harmonic Calibration seal. This is a resonance record, not a handwritten note.' }),
  'calibration-card-08': Object.freeze({ title: 'Residual Wave Etching', clue: 'Final resonance trace; its split-gold seal matches the Folio.' }),
});

function hashSeed(seed) {
  const value = String(seed ?? 'first-shift');
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed) {
  let state = hashSeed(seed);

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function chooseCluster(random, family) {
  const centers = INITIAL_CLUSTER_CENTERS[family];
  return centers[Math.floor(random() * centers.length)];
}

function createPosition(random, family, index) {
  const center = chooseCluster(random, family);
  const familyJitter = family === 'gear' ? 270 : 330;
  const sequenceOffset = (index % 5) * 13;
  const width = Math.round(center.x + (random() - 0.5) * familyJitter + sequenceOffset);
  const height = Math.round(center.y + (random() - 0.5) * 250 - sequenceOffset);
  const maxX = WORLD_BOUNDS.x + WORLD_BOUNDS.width - 120;
  const maxY = WORLD_BOUNDS.y + WORLD_BOUNDS.height - 100;

  return {
    x: Math.max(WORLD_BOUNDS.x + 40, Math.min(maxX, width)),
    y: Math.max(WORLD_BOUNDS.y + 40, Math.min(maxY, height)),
  };
}

function createDistributedPosition(random, family, index, width, height) {
  const center = chooseCluster(random, family);
  const horizontalSpread = family === 'gear' ? 520 : 600;
  const verticalSpread = 460;
  const sequenceOffset = (index % 5) * 9;
  const maxX = WORLD_BOUNDS.x + WORLD_BOUNDS.width - width - 40;
  const maxY = WORLD_BOUNDS.y + WORLD_BOUNDS.height - height - 40;

  return {
    x: Math.max(WORLD_BOUNDS.x + 40, Math.min(maxX,
      Math.round(center.x + (random() - 0.5) * horizontalSpread + sequenceOffset))),
    y: Math.max(WORLD_BOUNDS.y + 40, Math.min(maxY,
      Math.round(center.y + (random() - 0.5) * verticalSpread - sequenceOffset))),
  };
}

function positionCellKeys(position, width, height) {
  const firstColumn = Math.floor(position.x / FILLER_POSITION_CELL_SIZE);
  const lastColumn = Math.floor((position.x + width) / FILLER_POSITION_CELL_SIZE);
  const firstRow = Math.floor(position.y / FILLER_POSITION_CELL_SIZE);
  const lastRow = Math.floor((position.y + height) / FILLER_POSITION_CELL_SIZE);
  const keys = [];

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      keys.push(`${column},${row}`);
    }
  }

  return keys;
}

function createPositionIndex(items) {
  const cells = new Map();
  const itemsById = new Map();
  const index = { cells, itemsById };

  for (const item of items) addPositionToIndex(index, item);
  return index;
}

function addPositionToIndex(index, item) {
  index.itemsById.set(item.id, item);

  for (const key of positionCellKeys(item.position, item.width, item.height)) {
    if (!index.cells.has(key)) index.cells.set(key, new Set());
    index.cells.get(key).add(item.id);
  }
}

function nearbyPositionItems(index, position, width, height) {
  const ids = new Set();

  for (const key of positionCellKeys(position, width, height)) {
    for (const id of index.cells.get(key) ?? []) ids.add(id);
  }

  return [...ids].map((id) => index.itemsById.get(id));
}

function scorePosition(position, width, height, nearbyItems) {
  let score = 0;
  const positionArea = width * height;

  for (const item of nearbyItems) {
    const overlapWidth = Math.min(position.x + width, item.position.x + item.width)
      - Math.max(position.x, item.position.x);
    const overlapHeight = Math.min(position.y + height, item.position.y + item.height)
      - Math.max(position.y, item.position.y);
    if (overlapWidth <= 0 || overlapHeight <= 0) continue;

    const overlapArea = overlapWidth * overlapHeight;
    const itemArea = item.width * item.height;
    const completelyCoversOneItem = overlapArea >= positionArea || overlapArea >= itemArea;
    score += 1 + overlapArea / Math.min(positionArea, itemArea);
    if (completelyCoversOneItem) score += 100;
  }

  return score;
}

function createSpacedFillerPosition(random, family, index, width, height, positionIndex, fallback) {
  let bestPosition = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < FILLER_POSITION_ATTEMPTS; attempt += 1) {
    const position = createDistributedPosition(random, family, index + attempt, width, height);
    if (!isClearOfCalibrationCards(position, width, height)) continue;

    const nearbyItems = nearbyPositionItems(positionIndex, position, width, height);
    const score = scorePosition(position, width, height, nearbyItems);
    if (score < bestScore) {
      bestPosition = position;
      bestScore = score;
    }
    if (score === 0) return position;
  }

  return bestPosition ?? fallback;
}

function calibrationCardPosition(index) {
  const column = index % CALIBRATION_CARD_GRID.columns;
  const row = Math.floor(index / CALIBRATION_CARD_GRID.columns);

  return {
    x: CALIBRATION_CARD_GRID.x + column * CALIBRATION_CARD_GRID.columnStep,
    y: CALIBRATION_CARD_GRID.y + row * CALIBRATION_CARD_GRID.rowStep,
  };
}

function isClearOfCalibrationCards(position, width, height) {
  const gap = CALIBRATION_CARD_GRID.clearance;

  for (let index = 0; index < AUTHORED_CALIBRATION_COUNT; index += 1) {
    const cardPosition = calibrationCardPosition(index);
    const separatedHorizontally = cardPosition.x + CALIBRATION_CARD_GRID.width + gap < position.x
      || position.x + width + gap < cardPosition.x;
    const separatedVertically = cardPosition.y + CALIBRATION_CARD_GRID.height + gap < position.y
      || position.y + height + gap < cardPosition.y;

    if (!separatedHorizontally && !separatedVertically) return false;
  }

  return true;
}

function createFillerPosition(random, family, index, width, height) {
  let position = createPosition(random, family, index);

  // Keep the authored grid clickable even if future cluster definitions change.
  for (let attempt = 0; attempt < 16 && !isClearOfCalibrationCards(position, width, height); attempt += 1) {
    position = createPosition(random, family, index + attempt + 1);
  }

  if (!isClearOfCalibrationCards(position, width, height)) {
    const safeX = CALIBRATION_CARD_GRID.x + CALIBRATION_CARD_GRID.columns * CALIBRATION_CARD_GRID.columnStep + 140;
    const safeY = WORLD_BOUNDS.y + WORLD_BOUNDS.height - 180;
    position = {
      x: Math.min(WORLD_BOUNDS.x + WORLD_BOUNDS.width - width - 40, safeX),
      y: Math.min(WORLD_BOUNDS.y + WORLD_BOUNDS.height - height - 40, safeY),
    };
  }

  return position;
}

function createCalibrationCards() {
  const collection = COLLECTIONS.find((entry) => entry.id === 'harmonic-calibration');
  const destination = DESTINATIONS.find((entry) => entry.id === collection.destinationId);

  return collection.itemIds.map((id, index) => {
    const copy = CALIBRATION_CARD_COPY_BY_ID[id];
    return {
      id,
      family: 'blueprint-fragment',
      collectionId: collection.id,
      title: copy.title,
      clue: copy.clue,
      mark: CALIBRATION_GLYPHS[index],
      sequenceIndex: index + 1,
      position: calibrationCardPosition(index),
      width: CALIBRATION_CARD_GRID.width,
      height: CALIBRATION_CARD_GRID.height,
      rotation: 0,
      placement: { kind: 'workspace' },
      validation: 'unchecked',
      correctDestinationId: destination.id,
      authored: true,
    };
  });
}

function createFillerItem(random, layoutRandom, familyConfig, familyIndex, familySequence, positionIndex = null) {
  const number = String(familySequence).padStart(3, '0');
  const titleIndex = Math.floor(random() * familyConfig.titles.length);
  const clueIndex = Math.floor(random() * familyConfig.clues.length);
  const markIndex = Math.floor(random() * familyConfig.marks.length);
  // Consume the original seeded position draws so non-position content remains stable.
  const fallbackPosition = createFillerPosition(random, familyConfig.family, familyIndex, familyConfig.width, familyConfig.height);
  const position = positionIndex
    ? createSpacedFillerPosition(
      layoutRandom,
      familyConfig.family,
      familyIndex,
      familyConfig.width,
      familyConfig.height,
      positionIndex,
      fallbackPosition,
    )
    : fallbackPosition;
  const destination = DESTINATIONS.find((entry) => entry.id === familyConfig.destinationId);
  const roundedRotation = Math.round((random() - 0.5) * 20);

  return {
    id: `${familyConfig.idPrefix}-${number}`,
    family: familyConfig.family,
    collectionId: null,
    title: `${familyConfig.titles[titleIndex]} ${number}`,
    clue: familyConfig.clues[clueIndex],
    mark: familyConfig.marks[markIndex],
    position,
    width: familyConfig.width,
    height: familyConfig.height,
    rotation: roundedRotation === 0 ? 0 : roundedRotation,
    placement: { kind: 'workspace' },
    validation: 'unchecked',
    correctDestinationId: destination.id,
    authored: false,
  };
}

/**
 * Create deterministic initial laboratory content.
 *
 * The first eight entries are authored calibration cards. Remaining entries
 * use a seeded generator so their IDs, families, clues, and positions are
 * reproducible for a given seed and count.
 */
export function generateLegacyLab(seed = 'first-shift', count = 150) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('Lab item count must be a non-negative integer.');
  }

  if (count === 0) return [];

  const random = createRandom(seed);
  const layoutRandom = createRandom(`${String(seed ?? 'first-shift')}:filler-layout`);
  const authoredCount = Math.min(count, AUTHORED_CALIBRATION_COUNT);
  const items = createCalibrationCards().slice(0, authoredCount);
  const positionIndex = createPositionIndex(items);
  const familyCounts = new Map(FAMILY_CONFIG.map((entry) => [entry.family, 0]));

  while (items.length < count) {
    const familyIndex = items.length - authoredCount;
    const familyConfig = FAMILY_CONFIG[familyIndex % FAMILY_CONFIG.length];
    const nextCount = familyCounts.get(familyConfig.family) + 1;
    familyCounts.set(familyConfig.family, nextCount);
    const shouldRefinePosition = items.length < FRESH_GAME_LEGACY_ITEM_COUNT;
    const item = createFillerItem(
      random,
      layoutRandom,
      familyConfig,
      familyIndex,
      nextCount,
      shouldRefinePosition ? positionIndex : null,
    );
    items.push(item);
    if (shouldRefinePosition) addPositionToIndex(positionIndex, item);
  }

  return items;
}

const CHAPTER_ITEM_DATES = Object.freeze({
  'bell-before-dawn': Object.freeze(['1879-10-11', '1879-10-11', '1879-10-12', '1879-10-14', '1879-10-13', '1879-10-13', '1879-10-12', '1879-10-14']),
  'meridian-survey': Object.freeze(['1879-10-13', '1879-10-13', '1879-10-13', '1879-10-14', '1879-10-13', '1879-10-13', '1879-10-13', '1879-10-14']),
  'parallax-trials': Object.freeze(['1879-10-14', '1879-10-15', '1879-10-14', '1879-10-15', '1879-10-14', '1879-10-15', '1879-10-14', '1879-10-15']),
});

const CHAPTER_GROUP_ORIGINS = Object.freeze({
  'bell-before-dawn': Object.freeze({ x: 2940, y: 760 }),
  'meridian-survey': Object.freeze({ x: 3630, y: 760 }),
  'parallax-trials': Object.freeze({ x: 4320, y: 760 }),
});

function createAuthoredChapterItems() {
  const itemIndexByCollection = new Map();

  return AUTHORED_CHAPTER_ITEMS.map((definition) => {
    const itemIndex = itemIndexByCollection.get(definition.collectionId) ?? 0;
    itemIndexByCollection.set(definition.collectionId, itemIndex + 1);
    const origin = CHAPTER_GROUP_ORIGINS[definition.collectionId];
    const column = itemIndex % 4;
    const row = Math.floor(itemIndex / 4);
    const dimensions = {
      'handwritten-note': { width: 82, height: 60 },
      'experiment-record': { width: 90, height: 66 },
      'map-fragment': { width: 90, height: 64 },
      'formula-card': { width: 90, height: 64 },
    }[definition.family];

    return {
      ...definition,
      date: CHAPTER_ITEM_DATES[definition.collectionId][itemIndex],
      position: { x: origin.x + column * 116, y: origin.y + row * 88 },
      ...dimensions,
      rotation: 0,
      placement: { kind: 'workspace' },
      validation: 'unchecked',
    };
  });
}

/**
 * Generate the v3 laboratory while keeping every legacy record in its original
 * relative order. The three authored collections are inserted after the first
 * 150 records, before the remaining deterministic filler.
 */
export function generateLab(seed = 'first-shift', count = 150) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('Lab item count must be a non-negative integer.');
  }
  if (count <= 150) return generateLegacyLab(seed, count);

  const authoredChapterItems = createAuthoredChapterItems();
  const legacyCount = Math.min(LEGACY_LAB_ITEM_LIMIT, Math.max(150, count - authoredChapterItems.length));
  const legacyItems = generateLegacyLab(seed, legacyCount);
  return [
    ...legacyItems.slice(0, 150),
    ...authoredChapterItems,
    ...legacyItems.slice(150),
  ].slice(0, count);
}
