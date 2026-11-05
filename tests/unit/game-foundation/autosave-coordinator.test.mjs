import assert from 'node:assert/strict';
import test from 'node:test';

import { generateLab } from '../../../src/game/content/generateLab.js';
import { createNewGameState } from '../../../src/game/persistence/gameState.js';
import { loadGameFromStorage } from '../../../src/game/persistence/loadGame.js';
import { decodeSave, encodeSave } from '../../../src/game/persistence/save.js';
import { createAutosaveCoordinator } from '../../../src/game/persistence/autosaveCoordinator.js';

const AUTO_SAVE_KEY = 'lab-autosave';
const BACKUP_KEY = 'lab-backup';
const RECOVERY_KEY = 'lab-recovery';

function createGameState(itemCount, skillPoints = 0) {
  const state = createNewGameState();
  return {
    ...state,
    items: generateLab(state.contentSeed, itemCount),
    progress: { ...state.progress, skillPoints },
  };
}

function createMemoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

class FakeTimers {
  now = 0;
  nextId = 0;
  jobs = new Map();

  setTimeout = (callback, delay) => {
    const id = ++this.nextId;
    this.jobs.set(id, { at: this.now + delay, callback });
    return id;
  };

  clearTimeout = (id) => { this.jobs.delete(id); };

  advance(milliseconds) {
    const target = this.now + milliseconds;
    while (true) {
      const next = [...this.jobs.entries()]
        .sort(([, left], [, right]) => left.at - right.at)[0];
      if (!next || next[1].at > target) break;
      const [id, job] = next;
      this.jobs.delete(id);
      this.now = job.at;
      job.callback();
    }
    this.now = target;
  }
}

class FakeWorker {
  messages = [];
  listeners = new Map();
  onmessage = null;
  onerror = null;
  throwOnNextPost = null;

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message) {
    if (this.throwOnNextPost) {
      const error = this.throwOnNextPost;
      this.throwOnNextPost = null;
      throw error;
    }
    this.messages.push(structuredClone(message));
  }

  emit(type, event) {
    const handlers = new Set(this.listeners.get(type) ?? []);
    const propertyHandler = type === 'message' ? this.onmessage : type === 'error' ? this.onerror : null;
    if (propertyHandler) handlers.add(propertyHandler);
    for (const handler of handlers) handler(event);
  }

  respond(messageIndex) {
    const request = this.messages[messageIndex];
    this.emit('message', {
      data: {
        requestId: request.requestId,
        encodedSave: encodeSave(request.state),
      },
    });
  }

  fail(messageIndex, message = 'encoding worker failed') {
    const request = this.messages[messageIndex];
    this.emit('error', {
      message,
      error: new Error(message),
      requestId: request?.requestId,
      preventDefault() {},
    });
  }
}

function createHarness({ storage = createMemoryStorage(), initialEntries, debounceMs } = {}) {
  if (initialEntries) storage = createMemoryStorage(initialEntries);
  const worker = new FakeWorker();
  const timers = new FakeTimers();
  const statuses = [];
  const coordinator = createAutosaveCoordinator({
    worker,
    storage,
    autoSaveKey: AUTO_SAVE_KEY,
    backupKey: BACKUP_KEY,
    recoveryKey: RECOVERY_KEY,
    debounceMs,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    onStatus: (status) => statuses.push(status),
  });
  return { coordinator, worker, storage, timers, statuses };
}

function readSavedState(storage) {
  const loaded = loadGameFromStorage(storage, {
    autoSaveKey: AUTO_SAVE_KEY,
    backupKey: BACKUP_KEY,
    recoveryKey: RECOVERY_KEY,
    createNewGame: createNewGameState,
  });
  return loaded.state;
}

test('450ms debounce persists the latest 174- or 5,024-item state and survives reload', (t) => {
  for (const itemCount of [174, 5024]) {
    t.test(`${itemCount} item identities`, () => {
      const { coordinator, worker, storage, timers } = createHarness();
      const earlier = createGameState(174, 1);
      const latest = createGameState(itemCount, 7);

      coordinator.schedule(earlier);
      timers.advance(120);
      coordinator.schedule(latest);
      timers.advance(449);
      assert.equal(worker.messages.length, 0, 'worker encoding starts only after the full debounce interval');
      timers.advance(1);

      assert.equal(worker.messages.length, 1, 'the earlier scheduled state is replaced before encoding');
      assert.deepEqual(worker.messages[0].state.items.map((item) => item.id), latest.items.map((item) => item.id));
      worker.respond(0);

      const saved = readSavedState(storage);
      assert.equal(saved.items.length, itemCount);
      assert.deepEqual(saved.items.map((item) => item.id), latest.items.map((item) => item.id));
      assert.equal(saved.progress.skillPoints, 7);
      assert.ok(storage.getItem(AUTO_SAVE_KEY), 'the encoded autosave should be available after a simulated reload');
      coordinator.dispose();
    });
  }
});

test('a newer update after a worker response is persisted on its own debounce', () => {
  const { coordinator, worker, storage, timers } = createHarness();
  const first = createGameState(174, 1);
  const latest = createGameState(174, 8);

  coordinator.schedule(first);
  timers.advance(450);
  worker.respond(0);
  assert.equal(readSavedState(storage).progress.skillPoints, 1);

  coordinator.schedule(latest);
  timers.advance(450);
  worker.respond(1);

  assert.equal(readSavedState(storage).progress.skillPoints, 8);
  coordinator.dispose();
});

test('a stale worker reply cannot overwrite a newer request that completed first', () => {
  const { coordinator, worker, storage, timers } = createHarness();
  const older = createGameState(174, 2);
  const newer = createGameState(5024, 9);

  coordinator.schedule(older);
  timers.advance(450);
  coordinator.schedule(newer);
  timers.advance(450);
  assert.equal(worker.messages.length, 2);

  worker.respond(1);
  const newestRaw = storage.getItem(AUTO_SAVE_KEY);
  assert.equal(readSavedState(storage).progress.skillPoints, 9);
  worker.respond(0);

  assert.equal(storage.getItem(AUTO_SAVE_KEY), newestRaw, 'the late older result must not replace the latest save');
  assert.equal(readSavedState(storage).items.length, 5024);
  coordinator.dispose();
});

test('synchronous invalidation ignores a worker reply before the next state is scheduled', () => {
  const previousRaw = encodeSave(createGameState(174, 1));
  const { coordinator, worker, storage, timers } = createHarness({
    initialEntries: { [AUTO_SAVE_KEY]: previousRaw },
  });
  const pendingState = createGameState(174, 2);
  const latestState = createGameState(174, 3);

  coordinator.schedule(pendingState);
  timers.advance(450);
  assert.equal(worker.messages.length, 1);

  // App invokes invalidate synchronously when it queues a game update, before React's effect schedules its replacement.
  coordinator.invalidate();
  worker.respond(0);
  assert.equal(storage.getItem(AUTO_SAVE_KEY), previousRaw);

  coordinator.schedule(latestState);
  timers.advance(450);
  worker.respond(1);
  assert.equal(readSavedState(storage).progress.skillPoints, 3);
  coordinator.dispose();
});

test('invalidate on import cancels pending work and makes in-flight results stale', () => {
  const oldRaw = encodeSave(createGameState(174, 3));
  const backupRaw = encodeSave(createGameState(174, 4));
  const recoveryRaw = 'preserved-recovery-payload';
  const { coordinator, worker, storage, timers } = createHarness({
    initialEntries: {
      [AUTO_SAVE_KEY]: oldRaw,
      [BACKUP_KEY]: backupRaw,
      [RECOVERY_KEY]: recoveryRaw,
    },
  });
  const beforeImport = createGameState(174, 5);
  const imported = createGameState(5024, 11);

  coordinator.schedule(beforeImport);
  timers.advance(450);
  coordinator.invalidate();
  coordinator.schedule(imported);
  timers.advance(450);
  worker.respond(0);
  assert.equal(storage.getItem(AUTO_SAVE_KEY), oldRaw, 'the pre-import response must not overwrite the pre-import autosave');

  worker.respond(1);
  const saved = readSavedState(storage);
  assert.equal(saved.progress.skillPoints, 11);
  assert.equal(saved.items.length, 5024);
  assert.equal(storage.getItem(BACKUP_KEY), backupRaw, 'autosave coordination must leave the import backup alone');
  assert.equal(storage.getItem(RECOVERY_KEY), recoveryRaw, 'autosave coordination must leave recovery data alone');
  coordinator.dispose();
});

test('worker errors preserve the previous valid autosave and report autosave unavailable', () => {
  const previousRaw = encodeSave(createGameState(174, 6));
  const { coordinator, worker, storage, timers, statuses } = createHarness({
    initialEntries: { [AUTO_SAVE_KEY]: previousRaw },
  });

  coordinator.schedule(createGameState(5024, 12));
  timers.advance(450);
  worker.fail(0);

  assert.equal(storage.getItem(AUTO_SAVE_KEY), previousRaw, 'a failed encode must not replace the last valid save');
  assert.ok(statuses.some((status) => /unavailable/i.test(status)), 'the player-facing save status should report worker unavailability');
  coordinator.dispose();
});

test('storage write failure preserves prior bytes, reports unavailable, and disables later writes', () => {
  const previousRaw = encodeSave(createGameState(174, 20));
  const { coordinator, worker, storage, timers, statuses } = createHarness({
    initialEntries: { [AUTO_SAVE_KEY]: previousRaw },
  });
  const originalSetItem = storage.setItem.bind(storage);
  let autoSaveWriteAttempts = 0;
  storage.setItem = (key, value) => {
    if (key === AUTO_SAVE_KEY) {
      autoSaveWriteAttempts += 1;
      throw new Error('storage quota exceeded');
    }
    originalSetItem(key, value);
  };

  coordinator.schedule(createGameState(174, 21));
  timers.advance(450);
  assert.equal(worker.messages.length, 1, 'the debounced state should reach the encoder');
  assert.doesNotThrow(() => worker.respond(0), 'a storage write failure should be handled safely');

  assert.equal(storage.getItem(AUTO_SAVE_KEY), previousRaw, 'a failed write must preserve the last valid autosave bytes');
  assert.equal(autoSaveWriteAttempts, 1, 'the successful worker response should attempt one autosave write');
  assert.ok(statuses.some((status) => /unavailable/i.test(status)), 'the player-facing status should report autosave unavailable');

  coordinator.schedule(createGameState(174, 22));
  timers.advance(1000);
  assert.equal(worker.messages.length, 1, 'an unavailable coordinator should not send later states to the worker');
  assert.equal(autoSaveWriteAttempts, 1, 'an unavailable coordinator should not retry storage writes');
  assert.equal(storage.getItem(AUTO_SAVE_KEY), previousRaw, 'later schedules should leave the old autosave intact');
  coordinator.dispose();
});

test('a synchronous postMessage error preserves the old save and reports unavailable', () => {
  const previousRaw = encodeSave(createGameState(174, 13));
  const { coordinator, worker, storage, timers, statuses } = createHarness({
    initialEntries: { [AUTO_SAVE_KEY]: previousRaw },
  });
  worker.throwOnNextPost = new Error('worker is terminated');

  coordinator.schedule(createGameState(174, 14));
  assert.doesNotThrow(() => timers.advance(450));

  assert.equal(storage.getItem(AUTO_SAVE_KEY), previousRaw);
  assert.ok(statuses.some((status) => /unavailable/i.test(status)));
  coordinator.dispose();
});

test('an unavailable Worker preserves the previous save, reports unavailable, and disposes safely', () => {
  const previousRaw = encodeSave(createGameState(174, 18));
  const storage = createMemoryStorage({ [AUTO_SAVE_KEY]: previousRaw });
  const timers = new FakeTimers();
  const statuses = [];
  const coordinator = createAutosaveCoordinator({
    worker: null,
    storage,
    autoSaveKey: AUTO_SAVE_KEY,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    onStatus: (status) => statuses.push(status),
  });

  assert.doesNotThrow(() => coordinator.schedule(createGameState(5024, 19)));
  timers.advance(1000);

  assert.equal(storage.getItem(AUTO_SAVE_KEY), previousRaw, 'missing Worker support must not trigger a main-thread fallback write');
  assert.ok(statuses.some((status) => /unavailable/i.test(status)), 'the unavailable worker state must be visible to the player');
  assert.doesNotThrow(() => coordinator.dispose());
});

test('dispose clears pending requests and ignores replies without writing storage', () => {
  const previousRaw = encodeSave(createGameState(174, 15));
  const { coordinator, worker, storage, timers } = createHarness({
    initialEntries: { [AUTO_SAVE_KEY]: previousRaw },
  });

  coordinator.schedule(createGameState(174, 16));
  timers.advance(450);
  coordinator.dispose();
  worker.respond(0);
  coordinator.schedule(createGameState(5024, 17));
  timers.advance(1000);

  assert.equal(storage.getItem(AUTO_SAVE_KEY), previousRaw);
  assert.equal(worker.messages.length, 1, 'disposed coordinators do not enqueue more worker jobs');
});
