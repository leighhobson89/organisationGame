import assert from 'node:assert/strict';
import test from 'node:test';

import { getResonanceLensMatches } from '../../../src/game/domain/skillHighlights.js';

test('Resonance Lens matches other members of the focused collection only', () => {
  const focused = { id: 'focused', family: 'note', collectionId: 'collection-a' };
  const items = [
    focused,
    { id: 'same-collection', family: 'gear', collectionId: 'collection-a' },
    { id: 'same-family-other-collection', family: 'note', collectionId: 'collection-b' },
    { id: 'same-family-loose', family: 'note' },
    { id: 'unrelated', family: 'map-fragment' },
  ];
  const before = structuredClone(items);

  assert.deepEqual(getResonanceLensMatches(items, focused).map((item) => item.id), ['same-collection']);
  assert.deepEqual(items, before, 'matching must not change item state');
});

test('Resonance Lens falls back to family and excludes the focused item', () => {
  const focused = { id: 'focused', family: 'note' };
  const items = [
    focused,
    { id: 'same-family-a', family: 'note', collectionId: 'collection-a' },
    { id: 'same-family-b', family: 'note' },
    { id: 'different-family', family: 'gear' },
  ];

  assert.deepEqual(getResonanceLensMatches(items, focused).map((item) => item.id), ['same-family-a', 'same-family-b']);
  assert.deepEqual(getResonanceLensMatches(items, null), []);
});
