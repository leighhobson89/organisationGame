function normalizedRotation(item) {
  return Number.isFinite(item.rotation) ? item.rotation : 0;
}

/**
 * Return the broad-phase rectangle used to index an item. Workspace cards can
 * rotate beyond their unrotated layout box, so index their rotated AABB.
 */
export function getItemSpatialBounds(item) {
  const x = item.position.x;
  const y = item.position.y;
  const width = item.width;
  const height = item.height;
  const rotation = item.placement?.kind === 'workspace' ? normalizedRotation(item) : 0;

  if (rotation === 0) return { x, y, width, height };

  const radians = (rotation * Math.PI) / 180;
  const rotatedWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
  const rotatedHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  return {
    x: centerX - rotatedWidth / 2,
    y: centerY - rotatedHeight / 2,
    width: rotatedWidth,
    height: rotatedHeight,
  };
}

function containsInRotatedCard(item, point) {
  const rotation = item.placement?.kind === 'workspace' ? normalizedRotation(item) : 0;
  const centerX = item.position.x + item.width / 2;
  const centerY = item.position.y + item.height / 2;
  const radians = (-rotation * Math.PI) / 180;
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians) + centerX;
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians) + centerY;

  return localX >= item.position.x
    && localX <= item.position.x + item.width
    && localY >= item.position.y
    && localY <= item.position.y + item.height;
}

/**
 * Find the visually topmost item at a world point. SpatialIndex.query returns
 * entries in insertion (painter) order, so checking backward matches drawing.
 */
export function hitTestTopmostItem(index, worldPoint) {
  const candidates = index.query({
    x: worldPoint.x,
    y: worldPoint.y,
    width: 0,
    height: 0,
  });

  for (let candidateIndex = candidates.length - 1; candidateIndex >= 0; candidateIndex -= 1) {
    const item = candidates[candidateIndex].item;
    if (item && containsInRotatedCard(item, worldPoint)) return item;
  }

  return null;
}
