import assert from 'node:assert/strict';
import test from 'node:test';

import { screenToWorld, zoomAtPinch } from '../../../src/game/world/camera.js';

function approximately(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
}

test('pinch zoom keeps the world point under a moving midpoint anchored', () => {
  const camera = { panX: -380, panY: 215, scale: 0.8 };
  const start = { midpoint: { x: 180, y: 240 }, distance: 100 };
  const current = { midpoint: { x: 260, y: 190 }, distance: 150 };
  const startBefore = structuredClone(start);
  const currentBefore = structuredClone(current);
  const cameraBefore = structuredClone(camera);
  const anchoredWorldPoint = screenToWorld(start.midpoint, camera);

  const zoomed = zoomAtPinch(camera, start, current);
  const pointAfterPinch = screenToWorld(current.midpoint, zoomed);

  approximately(pointAfterPinch.x, anchoredWorldPoint.x);
  approximately(pointAfterPinch.y, anchoredWorldPoint.y);
  assert.equal(zoomed.scale, 1.2);
  assert.deepEqual(camera, cameraBefore, 'pinch calculations must not mutate the camera');
  assert.deepEqual(start, startBefore, 'pinch calculations must not mutate the starting gesture');
  assert.deepEqual(current, currentBefore, 'pinch calculations must not mutate the current gesture');
});

test('pinch zoom clamps the requested scale to the configured minimum and maximum', () => {
  const camera = { panX: 25, panY: -40, scale: 1 };
  const start = { midpoint: { x: 200, y: 180 }, distance: 100 };

  const zoomedOut = zoomAtPinch(camera, start, {
    midpoint: { x: 200, y: 180 },
    distance: 5,
  }, { minScale: 0.35, maxScale: 1.8 });
  const zoomedIn = zoomAtPinch(camera, start, {
    midpoint: { x: 200, y: 180 },
    distance: 400,
  }, { minScale: 0.35, maxScale: 1.8 });

  assert.equal(zoomedOut.scale, 0.35);
  assert.equal(zoomedIn.scale, 1.8);
});

test('pinch zoom rejects zero, negative, and non-finite distances', () => {
  const camera = { panX: 0, panY: 0, scale: 1 };
  const midpoint = { x: 120, y: 90 };
  const validStart = { midpoint, distance: 100 };
  const validCurrent = { midpoint, distance: 120 };

  for (const distance of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => zoomAtPinch(camera, { midpoint, distance }, validCurrent), /distance/i);
    assert.throws(() => zoomAtPinch(camera, validStart, { midpoint, distance }), /distance/i);
  }
});

test('pinch zoom validates midpoint coordinates and scale bounds', () => {
  const camera = { panX: 0, panY: 0, scale: 1 };
  const valid = { midpoint: { x: 120, y: 90 }, distance: 100 };

  assert.throws(() => zoomAtPinch(camera, {
    midpoint: { x: Number.NaN, y: 90 },
    distance: 100,
  }, valid), /midpoint|coordinate/i);
  assert.throws(() => zoomAtPinch(camera, valid, {
    midpoint: { x: 120, y: Number.POSITIVE_INFINITY },
    distance: 100,
  }), /midpoint|coordinate/i);
  assert.throws(() => zoomAtPinch(camera, valid, valid, { minScale: 0, maxScale: 2 }), /scale|bound/i);
  assert.throws(() => zoomAtPinch(camera, valid, valid, { minScale: 2, maxScale: 1 }), /scale|bound/i);
});
