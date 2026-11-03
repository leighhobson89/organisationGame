import { screenToWorld } from './camera.js';

function validateBounds(bounds) {
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)
    || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)
    || bounds.width <= 0 || bounds.height <= 0) {
    throw new TypeError('World bounds must have finite origins and positive dimensions.');
  }
}

function validateSize(size) {
  if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)
    || size.width <= 0 || size.height <= 0) {
    throw new TypeError('Atlas size must have positive finite width and height.');
  }
}

function validatePoint(point, label) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${label} coordinates must be finite numbers.`);
  }
}

function normalizePadding(padding) {
  if (Number.isFinite(padding)) {
    const amount = Math.max(0, padding);
    return { top: amount, right: amount, bottom: amount, left: amount };
  }

  const normalized = {
    top: Math.max(0, Number(padding?.top) || 0),
    right: Math.max(0, Number(padding?.right) || 0),
    bottom: Math.max(0, Number(padding?.bottom) || 0),
    left: Math.max(0, Number(padding?.left) || 0),
  };
  return normalized;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Fit a world rectangle into a local atlas rectangle while preserving aspect ratio.
 * The returned point conversion functions include letterboxing and world-bound clamps.
 */
export function createWorldAtlasProjection(worldBounds, size, padding = 0) {
  validateBounds(worldBounds);
  validateSize(size);
  const inset = normalizePadding(padding);
  const availableWidth = Math.max(1, size.width - inset.left - inset.right);
  const availableHeight = Math.max(1, size.height - inset.top - inset.bottom);
  const scale = Math.min(availableWidth / worldBounds.width, availableHeight / worldBounds.height);
  const mapWidth = worldBounds.width * scale;
  const mapHeight = worldBounds.height * scale;
  const offsetX = inset.left + (availableWidth - mapWidth) / 2;
  const offsetY = inset.top + (availableHeight - mapHeight) / 2;
  const mapRect = { x: offsetX, y: offsetY, width: mapWidth, height: mapHeight };

  return {
    scale,
    offsetX,
    offsetY,
    mapRect,
    projectPoint(point) {
      validatePoint(point, 'World point');
      const worldX = clamp(point.x, worldBounds.x, worldBounds.x + worldBounds.width);
      const worldY = clamp(point.y, worldBounds.y, worldBounds.y + worldBounds.height);
      return {
        x: offsetX + (worldX - worldBounds.x) * scale,
        y: offsetY + (worldY - worldBounds.y) * scale,
      };
    },
    unprojectPoint(point) {
      validatePoint(point, 'Atlas point');
      const mapX = clamp(point.x, mapRect.x, mapRect.x + mapRect.width);
      const mapY = clamp(point.y, mapRect.y, mapRect.y + mapRect.height);
      return {
        x: clamp(worldBounds.x + (mapX - offsetX) / scale, worldBounds.x, worldBounds.x + worldBounds.width),
        y: clamp(worldBounds.y + (mapY - offsetY) / scale, worldBounds.y, worldBounds.y + worldBounds.height),
      };
    },
  };
}

/** Aggregate in-bounds item positions into a fixed grid of density counters. */
export function buildAtlasDensity(items, worldBounds, columns, rows) {
  validateBounds(worldBounds);
  if (!Number.isInteger(columns) || columns <= 0 || !Number.isInteger(rows) || rows <= 0) {
    throw new RangeError('Atlas density columns and rows must be positive integers.');
  }

  const counts = Array(columns * rows).fill(0);
  const right = worldBounds.x + worldBounds.width;
  const bottom = worldBounds.y + worldBounds.height;
  for (const item of Array.isArray(items) ? items : []) {
    const position = item?.position;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) continue;
    if (position.x < worldBounds.x || position.x > right || position.y < worldBounds.y || position.y > bottom) continue;

    const column = Math.min(columns - 1, Math.floor(((position.x - worldBounds.x) / worldBounds.width) * columns));
    const row = Math.min(rows - 1, Math.floor(((position.y - worldBounds.y) / worldBounds.height) * rows));
    counts[row * columns + column] += 1;
  }
  return counts;
}

/** Return the visible, world-clipped camera rectangle projected into atlas space. */
export function getAtlasViewportPolygon(camera, viewportSize, worldBounds, projection) {
  validateBounds(worldBounds);
  validateSize(viewportSize);
  if (!camera || !Number.isFinite(camera.panX) || !Number.isFinite(camera.panY)
    || !Number.isFinite(camera.scale) || camera.scale <= 0) {
    throw new TypeError('Camera pan values must be finite and scale must be positive.');
  }
  if (!projection || typeof projection.projectPoint !== 'function') {
    throw new TypeError('A valid atlas projection is required.');
  }

  const viewportTopLeft = screenToWorld({ x: 0, y: 0 }, camera);
  const viewportBottomRight = screenToWorld({ x: viewportSize.width, y: viewportSize.height }, camera);
  const left = Math.max(worldBounds.x, viewportTopLeft.x);
  const top = Math.max(worldBounds.y, viewportTopLeft.y);
  const right = Math.min(worldBounds.x + worldBounds.width, viewportBottomRight.x);
  const bottom = Math.min(worldBounds.y + worldBounds.height, viewportBottomRight.y);
  if (left >= right || top >= bottom) return [];

  return [
    projection.projectPoint({ x: left, y: top }),
    projection.projectPoint({ x: right, y: top }),
    projection.projectPoint({ x: right, y: bottom }),
    projection.projectPoint({ x: left, y: bottom }),
  ];
}
