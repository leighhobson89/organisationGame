const FALLBACK_GAP = 8;

function placementTargetId(placement) {
  if (placement?.kind === 'destination') return placement.destinationId ?? placement.id;
  if (placement?.kind === 'scratchpad') return placement.scratchPadId ?? placement.id;
  return null;
}

function targetKind(target) {
  return target?.kind === 'scratch-pad' ? 'scratchpad' : target?.kind;
}

function matchesTarget(placement, target) {
  return placement?.kind === target.kind && placementTargetId(placement) === target.id;
}

function rectangleOverlaps(position, item, other) {
  if (!other?.position) return false;

  return position.x < other.position.x + (other.width ?? 0)
    && position.x + item.width > other.position.x
    && position.y < other.position.y + (other.height ?? 0)
    && position.y + item.height > other.position.y;
}

function getEntriesForTarget(target, destinations, scratchPads) {
  if (target.kind === 'destination') return destinations ?? [];
  if (target.kind === 'scratchpad') return scratchPads ?? [];
  return [];
}

function getCapacity(target, entry) {
  return target.kind === 'destination' ? entry.slotCount : entry.capacity;
}

function normalizeLayout(entry) {
  if (entry.layout) return entry.layout;

  const columns = Math.max(1, Math.floor((entry.width - 40) / 100));
  const rows = Math.max(1, Math.floor((entry.height - 76) / 74));
  return {
    columns,
    rows,
    insetX: 20,
    insetY: 76,
    cellWidth: 92,
    cellHeight: 66,
    gapX: FALLBACK_GAP,
    gapY: FALLBACK_GAP,
  };
}

function positionForSlot(entry, layout, item, slotIndex) {
  if (item.width > layout.cellWidth || item.height > layout.cellHeight) return null;

  const row = Math.floor(slotIndex / layout.columns);
  const column = slotIndex % layout.columns;
  const strideX = layout.cellWidth + (layout.gapX ?? FALLBACK_GAP);
  const strideY = layout.cellHeight + (layout.gapY ?? FALLBACK_GAP);
  const position = {
    x: entry.position.x + layout.insetX + column * strideX + (layout.cellWidth - item.width) / 2,
    y: entry.position.y + layout.insetY + row * strideY + (layout.cellHeight - item.height) / 2,
  };

  const contained = position.x >= entry.position.x
    && position.y >= entry.position.y
    && position.x + item.width <= entry.position.x + entry.width
    && position.y + item.height <= entry.position.y + entry.height;

  return contained ? position : null;
}

/** Return the canonical top-left position for one declared target slot. */
export function getTargetSlotPosition({ target: rawTarget, item, slotIndex, destinations, scratchPads }) {
  if (!rawTarget || !item || !Number.isInteger(slotIndex) || slotIndex < 0) return null;
  const target = { ...rawTarget, kind: targetKind(rawTarget) };
  if (target.kind !== 'destination' && target.kind !== 'scratchpad') return null;
  const entry = getEntriesForTarget(target, destinations, scratchPads).find((candidate) => candidate.id === target.id);
  if (!entry) return null;
  const capacity = getCapacity(target, entry);
  const layout = normalizeLayout(entry);
  if (!Number.isInteger(capacity) || slotIndex >= capacity) return null;
  return positionForSlot(entry, layout, item, slotIndex);
}

function compareSlotDistance(left, right, entry, layout, item, preferredPosition) {
  const leftPosition = positionForSlot(entry, layout, item, left);
  const rightPosition = positionForSlot(entry, layout, item, right);
  const leftDistance = Math.hypot(
    leftPosition.x + item.width / 2 - preferredPosition.x,
    leftPosition.y + item.height / 2 - preferredPosition.y,
  );
  const rightDistance = Math.hypot(
    rightPosition.x + item.width / 2 - preferredPosition.x,
    rightPosition.y + item.height / 2 - preferredPosition.y,
  );

  return leftDistance - rightDistance || left - right;
}

/**
 * Choose a contained, unoccupied layout slot for a move into a destination or
 * scratch pad. Pointer drops pass preferredPosition so the nearest free slot
 * wins; inspector moves use the current slot when staying on the same target,
 * otherwise the first free slot is chosen. Workspace placement stays loose.
 */
export function allocateTargetPlacement({
  target: rawTarget,
  item,
  items,
  destinations,
  scratchPads,
  preferredPosition,
}) {
  if (!rawTarget || !item || !Array.isArray(items)) {
    return { ok: false, reason: 'A target, item, and current item list are required.' };
  }

  const target = { ...rawTarget, kind: targetKind(rawTarget) };
  if (target.kind === 'workspace') {
    const position = preferredPosition ?? item.previousWorkspacePosition ?? item.position;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return { ok: false, reason: 'A valid workspace position is required.' };
    }

    return {
      ok: true,
      position: { x: position.x, y: position.y },
      slotIndex: null,
      placement: { kind: 'workspace' },
    };
  }

  if (target.kind !== 'destination' && target.kind !== 'scratchpad') {
    return { ok: false, reason: 'That laboratory target is not supported.' };
  }

  const entry = getEntriesForTarget(target, destinations, scratchPads).find((candidate) => candidate.id === target.id);
  if (!entry || !entry.position || !Number.isFinite(entry.width) || !Number.isFinite(entry.height)) {
    return { ok: false, reason: 'That laboratory target no longer exists.' };
  }

  const capacity = getCapacity(target, entry);
  const layout = normalizeLayout(entry);
  if (!Number.isInteger(capacity) || capacity <= 0) {
    return { ok: false, reason: 'That target has no available object slots.' };
  }
  if (!Number.isInteger(layout.columns) || layout.columns <= 0
    || !Number.isInteger(layout.rows) || layout.rows <= 0
    || layout.columns * layout.rows < capacity) {
    return { ok: false, reason: 'That target has an invalid slot layout.' };
  }
  if (!Number.isFinite(item.width) || !Number.isFinite(item.height) || item.width <= 0 || item.height <= 0) {
    return { ok: false, reason: 'This object has invalid dimensions and cannot be placed.' };
  }
  if (item.width > layout.cellWidth || item.height > layout.cellHeight) {
    return { ok: false, reason: 'This object is too large for the target slots.' };
  }

  // Validation status does not reduce occupancy: a misfiled object still
  // physically occupies its target until the player moves it again.
  const occupants = items.filter((other) => other.id !== item.id && matchesTarget(other.placement, target));
  if (occupants.length >= capacity) {
    return { ok: false, reason: 'That target is full; move an object out before adding another.' };
  }

  const occupiedSlots = new Set();
  for (const occupant of occupants) {
    const slotIndex = occupant.placement?.slotIndex;
    if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < capacity) occupiedSlots.add(slotIndex);
  }

  const currentSlot = matchesTarget(item.placement, target) ? item.placement.slotIndex : null;
  const candidates = Array.from({ length: capacity }, (_, slotIndex) => slotIndex)
    .filter((slotIndex) => !occupiedSlots.has(slotIndex));

  if (preferredPosition && Number.isFinite(preferredPosition.x) && Number.isFinite(preferredPosition.y)) {
    candidates.sort((left, right) => compareSlotDistance(left, right, entry, layout, item, preferredPosition));
  } else if (Number.isInteger(currentSlot) && currentSlot >= 0 && currentSlot < capacity) {
    candidates.sort((left, right) => (left === currentSlot ? -1 : right === currentSlot ? 1 : left - right));
  }

  for (const slotIndex of candidates) {
    const position = positionForSlot(entry, layout, item, slotIndex);
    if (!position) continue;

    // Older saves may have occupants without slot metadata. If one physically
    // overlaps a candidate inside this target, preserve it and try another slot.
    const overlapsUnslottedOccupant = occupants.some((other) => {
      const assignedSlot = other.placement?.slotIndex;
      if (Number.isInteger(assignedSlot) && assignedSlot >= 0 && assignedSlot < capacity) return false;
      return rectangleOverlaps(position, item, other);
    });
    if (overlapsUnslottedOccupant) continue;

    const placement = target.kind === 'destination'
      ? { kind: 'destination', destinationId: target.id, slotIndex }
      : { kind: 'scratchpad', scratchPadId: target.id, slotIndex };

    return { ok: true, position, slotIndex, placement };
  }

  return { ok: false, reason: 'That target is full; move an object out before adding another.' };
}

/**
 * Stage a set of target placements without mutating the live item records.
 * Selected occupants are treated as vacated before allocation begins, then
 * each planned placement occupies its slot for the next item in the batch.
 * A failure returns no partial allocations so callers can commit atomically.
 */
export function allocateBatchTargetPlacements({
  target,
  itemIds,
  items,
  destinations,
  scratchPads,
} = {}) {
  const failed = (reason) => ({ ok: false, reason, allocations: [] });
  if (!Array.isArray(itemIds) || !Array.isArray(items)) {
    return failed('A target, selected item IDs, and current item list are required.');
  }
  if (itemIds.some((itemId) => typeof itemId !== 'string' || itemId.length === 0)) {
    return failed('Every selected object must have a valid ID.');
  }

  const uniqueItemIds = [...new Set(itemIds)];
  if (uniqueItemIds.length === 0) {
    return failed('Select at least one object to move.');
  }

  const itemsById = new Map(items.map((item) => [item?.id, item]));
  const selectedItems = uniqueItemIds.map((itemId) => itemsById.get(itemId));
  if (selectedItems.some((item) => !item)) {
    return failed('One or more selected objects are no longer available.');
  }

  const selectedIdSet = new Set(uniqueItemIds);
  const stagedItems = items.filter((item) => !selectedIdSet.has(item?.id));
  const allocations = [];

  for (const item of selectedItems) {
    const allocation = allocateTargetPlacement({
      target,
      item,
      items: stagedItems,
      destinations,
      scratchPads,
    });
    if (!allocation.ok) return failed(allocation.reason);

    allocations.push({
      itemId: item.id,
      position: allocation.position,
      slotIndex: allocation.slotIndex,
      placement: allocation.placement,
    });
    stagedItems.push({ ...item, position: allocation.position, placement: allocation.placement });
  }

  return { ok: true, allocations };
}
