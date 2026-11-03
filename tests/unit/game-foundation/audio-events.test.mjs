import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GAME_AUDIO_EVENT_TYPES,
  emitGameAudioEvent,
  subscribeGameAudioEvents,
} from '../../../src/game/audio/audioEvents.js';

const expectedEventTypes = [
  'item.pickup',
  'item.drop',
  'item.placement.correct',
  'item.placement.invalid',
  'collection.completed',
  'puzzle.discovered',
  'puzzle.completed',
  'skill.unlocked',
  'skill.activated',
  'machinery.stage.changed',
  'invention.assembled',
  'invention.activated',
];

test('the audio event catalog exposes the stable gameplay event names', () => {
  assert.deepEqual(GAME_AUDIO_EVENT_TYPES, expectedEventTypes);
  assert.equal(Object.isFrozen(GAME_AUDIO_EVENT_TYPES), true, 'consumers cannot change the shared event catalog');
});

test('subscribers receive transient events with the original payload', () => {
  const received = [];
  const payload = { itemId: 'calibration-card-01', targetId: 'cabinet-calibration' };
  const unsubscribe = subscribeGameAudioEvents((event) => received.push(event));

  emitGameAudioEvent('item.placement.correct', payload);
  unsubscribe();

  assert.deepEqual(received, [{ type: 'item.placement.correct', payload }]);
});

test('listeners added or removed during emission affect the next event, not the current snapshot', (t) => {
  const received = [];
  let unsubscribeSecond;
  let unsubscribeAdded;
  let subscribedDuringEmission = false;

  const unsubscribeFirst = subscribeGameAudioEvents(() => {
    received.push('first');
    if (!subscribedDuringEmission) {
      subscribedDuringEmission = true;
      unsubscribeSecond();
      unsubscribeAdded = subscribeGameAudioEvents(() => received.push('added'));
    }
  });
  unsubscribeSecond = subscribeGameAudioEvents(() => received.push('second'));
  t.after(() => {
    unsubscribeFirst();
    unsubscribeSecond();
    unsubscribeAdded?.();
  });

  emitGameAudioEvent('item.pickup', { itemId: 'card-01' });
  assert.deepEqual(received, ['first', 'second']);

  received.length = 0;
  emitGameAudioEvent('item.drop', { itemId: 'card-01' });
  assert.deepEqual(received, ['first', 'added']);

});

test('unsubscribe is idempotent and stops subsequent delivery', () => {
  const received = [];
  const unsubscribe = subscribeGameAudioEvents((event) => received.push(event));

  unsubscribe();
  unsubscribe();
  emitGameAudioEvent('skill.activated', { skillId: 'resonance-lens' });

  assert.deepEqual(received, []);
});

test('events emitted without subscribers are not replayed to later subscribers', () => {
  assert.doesNotThrow(() => emitGameAudioEvent('collection.completed', { collectionId: 'calibration' }));

  const received = [];
  const unsubscribe = subscribeGameAudioEvents((event) => received.push(event));
  emitGameAudioEvent('puzzle.discovered', { puzzleId: 'pulse-sequence' });
  unsubscribe();

  assert.deepEqual(received, [{
    type: 'puzzle.discovered',
    payload: { puzzleId: 'pulse-sequence' },
  }]);
});

test('a throwing subscriber cannot prevent other subscribers from receiving the event', () => {
  const received = [];
  const unsubscribeThrowing = subscribeGameAudioEvents(() => {
    throw new Error('optional audio adapter failed');
  });
  const unsubscribeWorking = subscribeGameAudioEvents((event) => received.push(event.type));

  assert.doesNotThrow(() => emitGameAudioEvent('invention.activated'));

  unsubscribeThrowing();
  unsubscribeWorking();
  assert.deepEqual(received, ['invention.activated']);
});
