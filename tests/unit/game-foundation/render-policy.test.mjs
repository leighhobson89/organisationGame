import assert from 'node:assert/strict';
import test from 'node:test';

async function getRenderMode() {
  const module = await import('../../../src/game/world/renderPolicy.js');
  return module.getRenderMode;
}

test('detail enters overview at the scale boundary of 0.4', async () => {
  const renderMode = await getRenderMode();

  assert.equal(renderMode({ currentMode: 'detail', scale: 0.4, visibleCount: 8 }), 'overview');
  assert.equal(renderMode({ currentMode: 'detail', scale: 0.4001, visibleCount: 8 }), 'detail');
});

test('detail enters overview above 400 visible items even at close zoom', async () => {
  const renderMode = await getRenderMode();

  assert.equal(renderMode({ currentMode: 'detail', scale: 1, visibleCount: 400 }), 'detail');
  assert.equal(renderMode({ currentMode: 'detail', scale: 1, visibleCount: 401 }), 'overview');
});

test('overview hysteresis holds until scale is at least 0.5 and visible count is at most 320', async () => {
  const renderMode = await getRenderMode();

  assert.equal(renderMode({ currentMode: 'overview', scale: 0.49, visibleCount: 20 }), 'overview');
  assert.equal(renderMode({ currentMode: 'overview', scale: 0.7, visibleCount: 321 }), 'overview');
  assert.equal(renderMode({ currentMode: 'overview', scale: 0.5, visibleCount: 320 }), 'detail');
  assert.equal(renderMode({ currentMode: 'overview', scale: 0.5, visibleCount: 0 }), 'detail');
});

