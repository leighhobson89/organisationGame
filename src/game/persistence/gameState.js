import { COLLECTIONS, DESTINATIONS, getScratchPadsForOwnedSkills, PUZZLES, SCRATCH_PADS, SKILLS, WORLD_BOUNDS } from '../content/catalog.js';
import { generateLab, generateLegacyLab } from '../content/generateLab.js';
import { isCollectionComplete } from '../domain/completion.js';
import { validateDrop } from '../domain/placement.js';
import { allocateTargetPlacement, getTargetSlotPosition } from '../world/placementLayout.js';

export const CURRENT_GAME_STATE_VERSION = 3;
export const LEGACY_GAME_STATE_VERSION = 1;
export const PREVIOUS_GAME_STATE_VERSION = 2;

export const MAX_LEGACY_GAME_ITEMS = 5000;
export const MAX_GAME_ITEMS = MAX_LEGACY_GAME_ITEMS + 24;
export const MAX_ITEM_DIMENSION = 512;
export const DEFAULT_CONTENT_SEED = 'palimpsest-first-shift';

const DEFAULT_ITEM_COUNT = 174;
// Completion uses this frozen manifest to detect a valid but truncated v3 save.
export const DEFAULT_GAME_ITEM_IDS = Object.freeze(
  generateLab(DEFAULT_CONTENT_SEED, DEFAULT_ITEM_COUNT).map(({ id }) => id),
);
const MAX_DISCOVERIES = 5000;
const MAX_SKILL_POINTS = 10000;
const INVENTION_STAGES = new Set(['Dormant', 'Memory Crystal', 'Chronology Wheel']);

const chapterItems = generateLab(DEFAULT_CONTENT_SEED, DEFAULT_ITEM_COUNT).slice(150);
const canonicalItems = new Map([
  ...generateLegacyLab(DEFAULT_CONTENT_SEED, MAX_LEGACY_GAME_ITEMS),
  ...chapterItems,
].map((item) => [item.id, item]));
const canonicalItemsBySeed = new Map([[DEFAULT_CONTENT_SEED, canonicalItems]]);
const destinationsById = new Map(DESTINATIONS.map((entry) => [entry.id, entry]));
const scratchPadsById = new Map(SCRATCH_PADS.map((entry) => [entry.id, entry]));
const collectionIds = new Set(COLLECTIONS.map((entry) => entry.id));
const puzzleIds = new Set(PUZZLES.map((entry) => entry.id));
const skillIds = new Set(SKILLS.map((entry) => entry.id));
const legacyCollectionIds = new Set(['harmonic-calibration']);
const legacyPuzzleIds = new Set(['pulse-sequence']);
const legacySkillIds = new Set(['resonance-lens']);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertWorldPosition(position, itemWidth, itemHeight, label) {
  if (!isPlainObject(position) || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new TypeError(`${label} must contain finite world coordinates.`);
  }

  if (position.x < WORLD_BOUNDS.x || position.y < WORLD_BOUNDS.y
    || position.x + itemWidth > WORLD_BOUNDS.x + WORLD_BOUNDS.width
    || position.y + itemHeight > WORLD_BOUNDS.y + WORLD_BOUNDS.height) {
    throw new RangeError(`${label} must stay inside the laboratory world bounds.`);
  }

  return { x: position.x, y: position.y };
}

function normalizeIdList(value, knownIds, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);

  const normalized = [];
  const seen = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || !knownIds.has(id)) {
      throw new TypeError(`${label} contains an unknown id.`);
    }
    if (!seen.has(id)) normalized.push(id);
    seen.add(id);
  }

  return normalized;
}

function normalizePlacement(rawPlacement, itemId, allowLegacySlot = false, scratchPads = SCRATCH_PADS) {
  if (!isPlainObject(rawPlacement) || typeof rawPlacement.kind !== 'string') {
    throw new TypeError(`Object ${itemId} has an invalid placement target.`);
  }

  if (rawPlacement.kind === 'workspace') return { kind: 'workspace' };

  if (rawPlacement.kind === 'destination') {
    const destinationId = rawPlacement.destinationId ?? rawPlacement.id;
    const destination = destinationsById.get(destinationId);
    if (!destination) throw new TypeError(`Object ${itemId} targets an unknown destination.`);
    return {
      kind: 'destination',
      destinationId,
      ...(allowLegacySlot ? normalizeLegacySlot(rawPlacement.slotIndex) : normalizeSlotIndex(rawPlacement.slotIndex, destination.slotCount, itemId)),
    };
  }

  if (rawPlacement.kind === 'scratchpad') {
    const scratchPadId = rawPlacement.scratchPadId ?? rawPlacement.id;
    const scratchPad = scratchPads.find((entry) => entry.id === scratchPadId);
    if (!scratchPad) throw new TypeError(`Object ${itemId} targets an unknown scratch pad.`);
    return {
      kind: 'scratchpad',
      scratchPadId,
      ...(allowLegacySlot ? normalizeLegacySlot(rawPlacement.slotIndex) : normalizeSlotIndex(rawPlacement.slotIndex, scratchPad.capacity, itemId)),
    };
  }

  throw new TypeError(`Object ${itemId} has an unknown placement kind.`);
}

function normalizeLegacySlot(slotIndex) {
  return slotIndex === undefined || slotIndex === null ? {} : { slotIndex };
}

function normalizeSlotIndex(slotIndex, capacity, itemId) {
  if (slotIndex === undefined || slotIndex === null) return {};
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= capacity) {
    throw new RangeError(`Object ${itemId} has a slot outside its target capacity.`);
  }
  return { slotIndex };
}

function normalizeItem(rawItem, itemIds, {
  allowLegacySlots = false,
  preserveWorkspaceRotation = false,
  scratchPads = SCRATCH_PADS,
} = {}) {
  if (!isPlainObject(rawItem) || typeof rawItem.id !== 'string' || rawItem.id.length === 0 || rawItem.id.length > 160) {
    throw new TypeError('Every laboratory object must have a valid stable id.');
  }
  if (itemIds.has(rawItem.id)) throw new TypeError(`Duplicate laboratory object id: ${rawItem.id}.`);
  itemIds.add(rawItem.id);

  const canonical = canonicalItems.get(rawItem.id);
  if (!canonical) throw new TypeError(`Unknown laboratory object id: ${rawItem.id}.`);
  if (rawItem.family !== canonical.family || rawItem.correctDestinationId !== canonical.correctDestinationId) {
    throw new TypeError(`Object ${rawItem.id} does not match its trusted content definition.`);
  }
  if (!Number.isFinite(rawItem.width) || !Number.isFinite(rawItem.height)
    || rawItem.width <= 0 || rawItem.height <= 0
    || rawItem.width > MAX_ITEM_DIMENSION || rawItem.height > MAX_ITEM_DIMENSION) {
    throw new RangeError(`Object ${rawItem.id} has invalid dimensions.`);
  }
  if (preserveWorkspaceRotation && rawItem.rotation !== undefined
    && (!Number.isFinite(rawItem.rotation) || Math.abs(rawItem.rotation) > 360)) {
    throw new RangeError(`Object ${rawItem.id} has an invalid workspace rotation.`);
  }

  const position = assertWorldPosition(rawItem.position, canonical.width, canonical.height, `Object ${rawItem.id} position`);
  const placement = normalizePlacement(rawItem.placement, rawItem.id, allowLegacySlots, scratchPads);
  const previousWorkspacePosition = rawItem.previousWorkspacePosition === undefined
    ? undefined
    : assertWorldPosition(rawItem.previousWorkspacePosition, canonical.width, canonical.height, `Object ${rawItem.id} workspace position`);
  const validation = placement.kind === 'destination'
    ? validateDrop(canonical, { kind: 'destination', id: placement.destinationId }).status
    : 'unchecked';

  return {
    ...canonical,
    title: typeof rawItem.title === 'string' && rawItem.title.length <= 240 ? rawItem.title : canonical.title,
    clue: typeof rawItem.clue === 'string' && rawItem.clue.length <= 1000 ? rawItem.clue : canonical.clue,
    mark: typeof rawItem.mark === 'string' && rawItem.mark.length <= 32 ? rawItem.mark : canonical.mark,
    position,
    placement,
    rotation: placement.kind === 'workspace'
      ? preserveWorkspaceRotation && Number.isFinite(rawItem.rotation) ? rawItem.rotation : canonical.rotation
      : 0,
    validation,
    ...(previousWorkspacePosition ? { previousWorkspacePosition } : {}),
  };
}

function targetForPlacement(placement) {
  return placement.kind === 'destination'
    ? { kind: 'destination', id: placement.destinationId }
    : { kind: 'scratchpad', id: placement.scratchPadId };
}

function targetForPlacementKey(placement) {
  return `${placement.kind}:${placement.destinationId ?? placement.scratchPadId}`;
}

function workspaceSalvage(item) {
  const position = item.previousWorkspacePosition ?? item.position;
  return {
    ...item,
    position: { ...position },
    placement: { kind: 'workspace' },
    rotation: canonicalItems.get(item.id).rotation,
    previousWorkspacePosition: { ...position },
    validation: 'unchecked',
  };
}

function migrateV1Items(items) {
  const migrated = [];
  const claimedByTarget = new Map();
  let salvagedCount = 0;

  for (const item of items) {
    if (item.placement.kind === 'workspace') {
      migrated.push(item);
      continue;
    }

    const target = targetForPlacement(item.placement);
    const targetId = targetForPlacementKey(item.placement);
    const destination = target.kind === 'destination'
      ? destinationsById.get(target.id)
      : scratchPadsById.get(target.id);
    const capacity = target.kind === 'destination' ? destination.slotCount : destination.capacity;
    const claimed = claimedByTarget.get(targetId) ?? new Set();

    if (claimed.size >= capacity) {
      migrated.push(workspaceSalvage(item));
      salvagedCount += 1;
      continue;
    }

    const requestedSlot = item.placement.slotIndex;
    const canPreserveSlot = Number.isInteger(requestedSlot)
      && requestedSlot >= 0
      && requestedSlot < capacity
      && !claimed.has(requestedSlot)
      && getTargetSlotPosition({
        target,
        item,
        slotIndex: requestedSlot,
        destinations: DESTINATIONS,
        scratchPads: SCRATCH_PADS,
      });

    let slotIndex = canPreserveSlot ? requestedSlot : null;
    let position = canPreserveSlot
      ? getTargetSlotPosition({ target, item, slotIndex, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS })
      : null;

    if (slotIndex === null) {
      const oldPosition = item.position;
      const allocation = allocateTargetPlacement({
        target,
        item,
        items: [...migrated, item],
        destinations: DESTINATIONS,
        scratchPads: SCRATCH_PADS,
        preferredPosition: {
          x: oldPosition.x + item.width / 2,
          y: oldPosition.y + item.height / 2,
        },
      });
      if (!allocation.ok) {
        migrated.push(workspaceSalvage(item));
        salvagedCount += 1;
        continue;
      }
      slotIndex = allocation.slotIndex;
      position = allocation.position;
    }

    claimed.add(slotIndex);
    claimedByTarget.set(targetId, claimed);
    migrated.push({
      ...item,
      position,
      placement: target.kind === 'destination'
        ? { kind: 'destination', destinationId: target.id, slotIndex }
        : { kind: 'scratchpad', scratchPadId: target.id, slotIndex },
      rotation: 0,
    });
  }

  return { items: migrated, salvagedCount };
}

function validateV2TargetSlots(items, scratchPads = SCRATCH_PADS) {
  const countsByTarget = new Map();
  const slotsByTarget = new Map();

  for (const item of items) {
    if (item.placement.kind === 'workspace') continue;

    const target = targetForPlacement(item.placement);
    const targetKey = targetForPlacementKey(item.placement);
    const entry = target.kind === 'destination'
      ? destinationsById.get(target.id)
      : scratchPads.find((candidate) => candidate.id === target.id);
    const capacity = target.kind === 'destination' ? entry.slotCount : entry.capacity;
    const slotIndex = item.placement.slotIndex;
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= capacity) {
      throw new RangeError(`Object ${item.id} must occupy a valid target slot.`);
    }

    const count = (countsByTarget.get(targetKey) ?? 0) + 1;
    if (count > capacity) throw new RangeError(`Target ${target.id} exceeds its slot capacity.`);
    countsByTarget.set(targetKey, count);

    const slots = slotsByTarget.get(targetKey) ?? new Set();
    if (slots.has(slotIndex)) throw new TypeError(`Target ${target.id} has a duplicate occupied slot.`);
    slots.add(slotIndex);
    slotsByTarget.set(targetKey, slots);
  }

  const positionEpsilon = 0.01;
  for (const item of items) {
    if (item.placement.kind === 'workspace') continue;
    const target = targetForPlacement(item.placement);
    const canonicalPosition = getTargetSlotPosition({
      target,
      item,
      slotIndex: item.placement.slotIndex,
      destinations: DESTINATIONS,
      scratchPads,
    });
    if (!canonicalPosition
      || Math.abs(item.position.x - canonicalPosition.x) > positionEpsilon
      || Math.abs(item.position.y - canonicalPosition.y) > positionEpsilon) {
      throw new TypeError(`Object ${item.id} position does not match its declared target slot.`);
    }
  }
}

export function createDefaultProgress() {
  return {
    skillPoints: 0,
    completedCollectionIds: [],
    unlockedPuzzleIds: [],
    solvedPuzzleIds: [],
    ownedSkills: [],
  };
}

export function createStartingCamera() {
  const scale = 0.5;
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const windowHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const viewportHeight = windowHeight - 68;
  const focus = {
    x: viewportWidth <= 480 ? 944 : viewportWidth <= 720 ? 1106 : 1360,
    y: Math.min(650, viewportHeight + 130),
  };
  const shortMobileViewport = viewportWidth <= 720 && windowHeight >= 360 && windowHeight <= 439;
  return {
    panX: viewportWidth / 2 + 70 - focus.x * scale,
    panY: viewportHeight / 2 - focus.y * scale - (shortMobileViewport ? 20 : 0),
    scale,
  };
}

export function createNewGameState() {
  return normalizeGameState({
    version: CURRENT_GAME_STATE_VERSION,
    contentSeed: DEFAULT_CONTENT_SEED,
    items: generateLab(DEFAULT_CONTENT_SEED, DEFAULT_ITEM_COUNT),
    progress: createDefaultProgress(),
    camera: createStartingCamera(),
    inventionStage: 'Dormant',
    notebook: { discoveries: [] },
  });
}

export function normalizeGameStateWithMigration(state) {
  if (!isPlainObject(state) || !Array.isArray(state.items) || state.items.length === 0) {
    throw new TypeError('Save data must contain laboratory objects.');
  }
  if (![LEGACY_GAME_STATE_VERSION, PREVIOUS_GAME_STATE_VERSION, CURRENT_GAME_STATE_VERSION].includes(state.version)) {
    throw new TypeError('This save version is not supported by the laboratory.');
  }
  const itemLimit = state.version === CURRENT_GAME_STATE_VERSION ? MAX_GAME_ITEMS : MAX_LEGACY_GAME_ITEMS;
  if (state.items.length > itemLimit) throw new RangeError(`A laboratory can contain at most ${itemLimit} objects.`);

  const rawProgress = state.progress ?? {};
  if (!isPlainObject(rawProgress)) throw new TypeError('Laboratory progress must be an object.');
  const ownedSkills = normalizeIdList(
    rawProgress.ownedSkills,
    state.version < CURRENT_GAME_STATE_VERSION ? legacySkillIds : skillIds,
    'Owned skills',
  );
  const scratchPads = state.version === CURRENT_GAME_STATE_VERSION
    ? getScratchPadsForOwnedSkills(ownedSkills)
    : SCRATCH_PADS;

  const itemIds = new Set();
  const normalizedItems = state.items.map((item) => normalizeItem(item, itemIds, {
    allowLegacySlots: state.version === LEGACY_GAME_STATE_VERSION,
    preserveWorkspaceRotation: state.version >= PREVIOUS_GAME_STATE_VERSION,
    scratchPads,
  }));
  if (state.version < CURRENT_GAME_STATE_VERSION && chapterItems.some((item) => itemIds.has(item.id))) {
    throw new TypeError('A legacy save cannot contain second-chapter objects.');
  }
  if (state.version === PREVIOUS_GAME_STATE_VERSION) validateV2TargetSlots(normalizedItems);
  const legacyMigration = state.version === LEGACY_GAME_STATE_VERSION
    ? migrateV1Items(normalizedItems)
    : { items: normalizedItems, salvagedCount: 0 };
  const items = state.version === CURRENT_GAME_STATE_VERSION
    ? legacyMigration.items
    : [...legacyMigration.items, ...chapterItems.map((item) => ({ ...item, position: { ...item.position }, placement: { ...item.placement } }))];
  validateV2TargetSlots(items, scratchPads);
  const migration = {
    items,
    salvagedCount: legacyMigration.salvagedCount,
  };
  const camera = state.camera ?? createStartingCamera();
  if (!isPlainObject(camera) || !Number.isFinite(camera.panX) || !Number.isFinite(camera.panY)
    || !Number.isFinite(camera.scale) || camera.scale < 0.2 || camera.scale > 2.5) {
    throw new TypeError('This save has invalid laboratory camera settings.');
  }

  const skillPoints = rawProgress.skillPoints ?? 0;
  if (!Number.isInteger(skillPoints) || skillPoints < 0 || skillPoints > MAX_SKILL_POINTS) {
    throw new RangeError('Laboratory skill points are outside the supported range.');
  }

  const progress = {
    ...createDefaultProgress(),
    skillPoints,
    completedCollectionIds: normalizeIdList(rawProgress.completedCollectionIds, state.version < CURRENT_GAME_STATE_VERSION ? legacyCollectionIds : collectionIds, 'Completed collections'),
    unlockedPuzzleIds: normalizeIdList(rawProgress.unlockedPuzzleIds, state.version < CURRENT_GAME_STATE_VERSION ? legacyPuzzleIds : puzzleIds, 'Unlocked puzzles'),
    solvedPuzzleIds: normalizeIdList(rawProgress.solvedPuzzleIds, state.version < CURRENT_GAME_STATE_VERSION ? legacyPuzzleIds : puzzleIds, 'Solved puzzles'),
    ownedSkills,
  };

  if (state.version === CURRENT_GAME_STATE_VERSION) {
    const chapterCollections = COLLECTIONS.filter((collection) => collection.chapter === 2);
    for (const collection of chapterCollections) {
      const filed = isCollectionComplete(collection, items);
      const recorded = progress.completedCollectionIds.includes(collection.id);
      if (filed && !recorded) {
        throw new TypeError(`Saved progress for ${collection.id} is missing its earned completion marker.`);
      }
    }

    const chronologyPuzzle = PUZZLES.find((puzzle) => (puzzle.requiresCompletedCollectionIds ?? []).length > 0);
    if (chronologyPuzzle) {
      const prerequisitesMet = chronologyPuzzle.requiresCompletedCollectionIds.every((id) => {
        const collection = chapterCollections.find((entry) => entry.id === id);
        return collection && progress.completedCollectionIds.includes(id);
      });
      const unlocked = progress.unlockedPuzzleIds.includes(chronologyPuzzle.id);
      const solved = progress.solvedPuzzleIds.includes(chronologyPuzzle.id);
      if (unlocked !== prerequisitesMet || (solved && !unlocked)) {
        throw new TypeError('Saved chronology puzzle progress does not match its collection prerequisites.');
      }
    }

    if (progress.solvedPuzzleIds.some((id) => !progress.unlockedPuzzleIds.includes(id))) {
      throw new TypeError('A solved puzzle must also be recorded as unlocked.');
    }
  }

  const rawNotebook = state.notebook ?? { discoveries: [] };
  if (!isPlainObject(rawNotebook) || !Array.isArray(rawNotebook.discoveries)
    || rawNotebook.discoveries.length > MAX_DISCOVERIES
    || rawNotebook.discoveries.some((discovery) => typeof discovery !== 'string' || discovery.length > 240)) {
    throw new TypeError('Laboratory notebook discoveries are invalid.');
  }

  const inventionStage = state.inventionStage ?? 'Dormant';
  if (typeof inventionStage !== 'string' || !INVENTION_STAGES.has(inventionStage)) {
    throw new TypeError('The saved invention stage is not recognized.');
  }

  const selectedItemId = state.selectedItemId ?? null;
  if (selectedItemId !== null && !itemIds.has(selectedItemId)) {
    throw new TypeError('The saved selected object does not exist in this laboratory.');
  }

  const contentSeed = state.contentSeed ?? DEFAULT_CONTENT_SEED;
  if (typeof contentSeed !== 'string' || contentSeed.length === 0 || contentSeed.length > 128) {
    throw new TypeError('The laboratory content seed is invalid.');
  }

  return {
    state: {
      version: CURRENT_GAME_STATE_VERSION,
      contentSeed,
      items,
      progress,
      camera: { panX: camera.panX, panY: camera.panY, scale: camera.scale },
      selectedItemId,
      inventionStage,
      notebook: { discoveries: [...rawNotebook.discoveries] },
    },
    migratedFromVersion: state.version === CURRENT_GAME_STATE_VERSION ? false : state.version,
    salvagedCount: migration.salvagedCount,
  };
}

export function normalizeGameState(state) {
  return normalizeGameStateWithMigration(state).state;
}

export function getCanonicalItemRotation(itemId, contentSeed = DEFAULT_CONTENT_SEED) {
  let itemsForSeed = canonicalItemsBySeed.get(contentSeed);
  if (!itemsForSeed) {
    itemsForSeed = new Map(generateLab(contentSeed, MAX_GAME_ITEMS).map((item) => [item.id, item]));
    canonicalItemsBySeed.set(contentSeed, itemsForSeed);
  }
  return itemsForSeed.get(itemId)?.rotation ?? canonicalItems.get(itemId)?.rotation ?? 0;
}
