/**
 * Transient gameplay events for optional audio adapters.
 *
 * This module deliberately has no playback, persistence, or replay behavior.
 */
export const GAME_AUDIO_EVENT_TYPES = Object.freeze([
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
]);

const knownEventTypes = new Set(GAME_AUDIO_EVENT_TYPES);
const listeners = new Set();

/** Subscribe to all future gameplay audio events. Returns an idempotent cleanup function. */
export function subscribeGameAudioEvents(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('A gameplay audio event listener must be a function.');
  }

  listeners.add(listener);
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    listeners.delete(listener);
  };
}

/** Publish an event to the current listener snapshot; events are never queued or replayed. */
export function emitGameAudioEvent(type, payload = {}) {
  if (!knownEventTypes.has(type)) {
    throw new TypeError(`Unknown gameplay audio event type: ${String(type)}`);
  }
  if (listeners.size === 0) return;

  const event = Object.freeze({ type, payload: payload ?? {} });
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (error) {
      try {
        globalThis.console?.error?.('A gameplay audio event listener failed.', error);
      } catch {
        // Optional listeners must never interrupt gameplay, even if logging is unavailable.
      }
    }
  }
}
