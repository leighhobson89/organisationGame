import assert from 'node:assert/strict';
import test from 'node:test';

import { SpatialIndex } from '../../../src/game/world/spatialIndex.js';

async function getHitTest() {
  const module = await import('../../../src/game/world/hitTest.js');
  return module.hitTestTopmostItem;
}

function addItem(index, item, broadPhaseBounds = {
  x: item.position.x,
  y: item.position.y,
  width: item.width,
  height: item.height,
}) {
  index.insert({
    id: item.id,
    x: broadPhaseBounds.x,
    y: broadPhaseBounds.y,
    width: broadPhaseBounds.width,
    height: broadPhaseBounds.height,
    item,
  });
}

function rotatedAabb(item) {
  const radians = (item.rotation * Math.PI) / 180;
  const centerX = item.position.x + item.width / 2;
  const centerY = item.position.y + item.height / 2;
  const width = Math.abs(item.width * Math.cos(radians)) + Math.abs(item.height * Math.sin(radians));
  const height = Math.abs(item.width * Math.sin(radians)) + Math.abs(item.height * Math.cos(radians));
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

test('topmost hit testing uses spatial-index candidates and reverse stable painter order', async () => {
  const hitTest = await getHitTest();
  const index = new SpatialIndex(32);
  const lower = { id: 'lower', position: { x: 40, y: 50 }, width: 80, height: 50, rotation: 0 };
  const upper = { id: 'upper', position: { x: 55, y: 60 }, width: 80, height: 50, rotation: 0 };
  addItem(index, lower);
  addItem(index, upper);

  const originalQuery = index.query.bind(index);
  let queryCount = 0;
  index.query = (area) => {
    queryCount += 1;
    return originalQuery(area);
  };

  const hit = hitTest(index, { x: 70, y: 70 });

  assert.ok(queryCount > 0, 'pointer hits should use the spatial index broad phase');
  assert.equal(hit?.id, 'upper', 'the visually later overlapping item should win');
});

test('rotated-card hit testing accepts painted corners and rejects empty AABB corners', async () => {
  const hitTest = await getHitTest();
  const index = new SpatialIndex(16);
  const item = {
    id: 'rotated-card',
    position: { x: 50, y: 90 },
    width: 100,
    height: 20,
    rotation: 45,
    placement: { kind: 'workspace' },
  };
  addItem(index, item, rotatedAabb(item));

  const paintedCornerHit = hitTest(index, { x: 134, y: 134 });
  const emptyBoundingBoxCorner = hitTest(index, { x: 70, y: 94 });

  assert.equal(paintedCornerHit?.id, item.id, 'a point inside the rotated card must remain clickable outside its unrotated rectangle');
  assert.equal(emptyBoundingBoxCorner, null, 'empty corners of the broad-phase rectangle are not actual hits');
});

