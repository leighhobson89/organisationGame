import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAtlasDensity,
  createWorldAtlasProjection,
  getAtlasViewportPolygon,
} from '../../../src/game/world/atlasMap.js';

function approximately(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
}

function boundsOf(points) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

test('World atlas projection maps nonzero world bounds forward and back', () => {
  const worldBounds = { x: 100, y: 200, width: 800, height: 400 };
  const projection = createWorldAtlasProjection(worldBounds, { width: 500, height: 300 }, 20);
  const worldPoints = [
    { x: 100, y: 200 },
    { x: 500, y: 400 },
    { x: 900, y: 600 },
  ];

  assert.deepEqual(projection.projectPoint(worldPoints[0]), {
    x: projection.mapRect.x,
    y: projection.mapRect.y,
  }, 'the nonzero world origin should map to the atlas content origin');
  assert.deepEqual(projection.projectPoint(worldPoints[2]), {
    x: projection.mapRect.x + projection.mapRect.width,
    y: projection.mapRect.y + projection.mapRect.height,
  }, 'the world far corner should map to the atlas content far corner');

  for (const worldPoint of worldPoints) {
    const projected = projection.projectPoint(worldPoint);
    const restored = projection.unprojectPoint(projected);
    approximately(restored.x, worldPoint.x);
    approximately(restored.y, worldPoint.y);
  }
});

test('World atlas projection preserves aspect ratio and centers letterboxed bounds', () => {
  const projection = createWorldAtlasProjection(
    { x: 0, y: 0, width: 2000, height: 1000 },
    { width: 300, height: 300 },
    16,
  );

  assert.equal(projection.scale, 0.134);
  assert.deepEqual(projection.mapRect, { x: 16, y: 83, width: 268, height: 134 });
  approximately(projection.mapRect.width / projection.mapRect.height, 2);
  approximately(projection.mapRect.x, 16);
  approximately(projection.mapRect.y, 16 + (268 - projection.mapRect.height) / 2);
});

test('World atlas projection clamps out-of-bounds points to the map rectangle', () => {
  const projection = createWorldAtlasProjection(
    { x: 100, y: 200, width: 1000, height: 500 },
    { width: 420, height: 260 },
    12,
  );
  const outside = projection.projectPoint({ x: -500, y: 4000 });

  assert.deepEqual(outside, {
    x: projection.mapRect.x,
    y: projection.mapRect.y + projection.mapRect.height,
  });
});

test('World atlas viewport polygon is clipped to world bounds before projection', () => {
  const worldBounds = { x: 100, y: 200, width: 1000, height: 500 };
  const projection = createWorldAtlasProjection(worldBounds, { width: 300, height: 200 }, 10);
  const polygon = getAtlasViewportPolygon(
    { panX: -20, panY: -25, scale: 0.5 },
    { width: 200, height: 100 },
    worldBounds,
    projection,
  );

  assert.ok(polygon.length >= 3, 'a viewport intersecting the world should produce a visible polygon');
  const projectedBounds = boundsOf(polygon);
  approximately(projectedBounds.minX, projection.mapRect.x);
  approximately(projectedBounds.minY, projection.mapRect.y);
  approximately(projectedBounds.maxX, projection.mapRect.x + 340 * projection.scale);
  approximately(projectedBounds.maxY, projection.mapRect.y + 50 * projection.scale);
  for (const point of polygon) {
    assert.ok(point.x >= projection.mapRect.x && point.x <= projection.mapRect.x + projection.mapRect.width,
      'clipped viewport x coordinates should stay in the atlas world rectangle');
    assert.ok(point.y >= projection.mapRect.y && point.y <= projection.mapRect.y + projection.mapRect.height,
      'clipped viewport y coordinates should stay in the atlas world rectangle');
  }
});

test('World atlas density aggregation returns a fixed-size bounded count array', () => {
  const worldBounds = { x: 50, y: 75, width: 1000, height: 500 };
  const items = [
    { id: 'north-west', position: { x: 50, y: 75 } },
    { id: 'north-east', position: { x: 1050, y: 75 } },
    { id: 'south-west', position: { x: 50, y: 575 } },
    { id: 'south-east', position: { x: 1050, y: 575 } },
    { id: 'middle', position: { x: 550, y: 325 } },
  ];

  const counts = buildAtlasDensity(items, worldBounds, 4, 3);

  assert.ok(Array.isArray(counts), 'density must be represented by aggregate bins');
  assert.equal(counts.length, 12, 'density memory should depend on the fixed grid dimensions');
  assert.ok(counts.every((count) => Number.isInteger(count) && count >= 0));
  assert.equal(counts.reduce((total, count) => total + count, 0), items.length,
    'every in-bounds item should contribute exactly one count');
  assert.equal(counts.filter((count) => count > 0).length, 5,
    'items in distinct cells should increment their own bins');
});

test('World atlas density aggregates 5,024 items into the fixed grid', () => {
  const worldBounds = { x: 100, y: 250, width: 5200, height: 3400 };
  const columns = 24;
  const rows = 16;
  const items = Array.from({ length: 5024 }, (_, index) => ({
    id: `density-item-${index}`,
    position: {
      x: worldBounds.x + ((index * 127) % worldBounds.width),
      y: worldBounds.y + ((index * 83) % worldBounds.height),
    },
  }));

  const counts = buildAtlasDensity(items, worldBounds, columns, rows);

  assert.ok(Array.isArray(counts));
  assert.equal(counts.length, columns * rows,
    '5,024 input records must not allocate one output record per item');
  assert.equal(counts.reduce((total, count) => total + count, 0), 5024);
  assert.ok(Math.max(...counts) > 1, 'collocated bins should accumulate multiple items');
  assert.ok(counts.every((count) => Number.isInteger(count) && count >= 0));
});
