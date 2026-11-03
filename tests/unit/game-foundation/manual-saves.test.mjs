import assert from 'node:assert/strict';
import test from 'node:test';

import { AUTO_SAVE_KEY, BACKUP_SAVE_KEY, MANUAL_SAVE_KEY, RECOVERY_SAVE_KEY } from '../../../src/game/persistence/loadGame.js';
import { createNewGameState } from '../../../src/game/persistence/gameState.js';
import { encodeSave } from '../../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../../src/game/preferences/preferences.js';
import {
  deleteManualSaveSlot,
  readManualSaveSlots,
  saveManualSaveSlot,
} from '../../../src/game/persistence/manualSaves.js';

const slotIds = [1, 2, 3];
const slotTwoKey = 'palimpsest-laboratory.manual.slot-2.v1';
const slotThreeKey = 'palimpsest-laboratory.manual.slot-3.v1';

function createMemoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function createSave(skillPoints = 0) {
  const state = createNewGameState();
  return encodeSave({
    ...state,
    progress: { ...state.progress, skillPoints },
  });
}

function createSlotEnvelope(slotId, encodedSave, savedAt = '2026-11-03T12:00:00.000Z') {
  return JSON.stringify({ version: 1, slotId, savedAt, encodedSave });
}

function getSlot(slots, slotId) {
  return slots.find((slot) => slot.slotId === slotId);
}

test('manual save slots start empty and save an independently readable compressed snapshot', () => {
  const storage = createMemoryStorage();
  const snapshot = createSave(4);

  assert.deepEqual(readManualSaveSlots(storage).slots.map(({ slotId, status }) => ({ slotId, status })), [
    { slotId: 1, status: 'empty' },
    { slotId: 2, status: 'empty' },
    { slotId: 3, status: 'empty' },
  ]);

  const savedAt = '2026-11-03T12:30:00.000Z';
  const result = saveManualSaveSlot(storage, 2, snapshot, {
    now: () => new Date(savedAt),
  });

  assert.equal(result.status, 'saved');
  assert.equal(storage.getItem(MANUAL_SAVE_KEY), null, 'saving Slot 2 must not write the legacy Slot 1 key');
  assert.equal(storage.getItem(slotThreeKey), null, 'saving Slot 2 must not overwrite Slot 3');
  const slotTwoEnvelope = JSON.parse(storage.getItem(slotTwoKey));
  assert.deepEqual(slotTwoEnvelope, {
    version: 1,
    slotId: 2,
    savedAt,
    encodedSave: snapshot,
  });

  const slot = getSlot(readManualSaveSlots(storage).slots, 2);
  assert.equal(slot.status, 'saved');
  assert.equal(slot.encodedSave, snapshot);
  assert.equal(slot.savedAt, savedAt);
});

test('an occupied slot cannot be overwritten until confirmed and a confirmed overwrite affects only that slot', () => {
  const original = createSave(1);
  const replacement = createSave(8);
  const storage = createMemoryStorage();
  const firstSavedAt = '2026-11-03T12:00:00.000Z';
  const nextSavedAt = '2026-11-03T13:00:00.000Z';

  assert.equal(saveManualSaveSlot(storage, 1, original, { now: () => new Date(firstSavedAt) }).status, 'saved');
  const originalRaw = storage.getItem(MANUAL_SAVE_KEY);

  assert.equal(saveManualSaveSlot(storage, 1, replacement, { now: () => new Date(nextSavedAt) }).status, 'confirmation-required');
  assert.equal(storage.getItem(MANUAL_SAVE_KEY), originalRaw, 'a declined overwrite must preserve the saved snapshot');

  const confirmed = saveManualSaveSlot(storage, 1, replacement, {
    overwriteConfirmed: true,
    now: () => new Date(nextSavedAt),
  });
  assert.equal(confirmed.status, 'saved');
  assert.equal(JSON.parse(storage.getItem(MANUAL_SAVE_KEY)).encodedSave, replacement);
  assert.deepEqual(readManualSaveSlots(storage).slots.map(({ slotId, status }) => ({ slotId, status })), [
    { slotId: 1, status: 'saved' },
    { slotId: 2, status: 'empty' },
    { slotId: 3, status: 'empty' },
  ]);
});

test('a legacy compressed MANUAL_SAVE_KEY is read as Slot 1 without rewriting it', () => {
  const legacySave = createSave(3);
  const storage = createMemoryStorage({ [MANUAL_SAVE_KEY]: legacySave });

  const slots = readManualSaveSlots(storage).slots;
  const legacySlot = getSlot(slots, 1);
  assert.equal(legacySlot.status, 'saved');
  assert.equal(legacySlot.encodedSave, legacySave);
  assert.equal(legacySlot.savedAt, null, 'a bare legacy payload has no trustworthy timestamp');
  assert.equal(legacySlot.legacy, true);
  assert.equal(storage.getItem(MANUAL_SAVE_KEY), legacySave, 'reading a legacy save must not rewrite it');
  assert.deepEqual(slots.filter(({ slotId }) => slotId !== 1).map(({ status }) => status), ['empty', 'empty']);
});

test('a malformed slot is reported without hiding valid neighboring slots', () => {
  const validSave = createSave(5);
  const storage = createMemoryStorage({
    [slotTwoKey]: JSON.stringify({ version: 1, slotId: 2, savedAt: 'not-a-date', encodedSave: validSave }),
    [slotThreeKey]: JSON.stringify({ version: 1, slotId: 3, savedAt: '2026-11-03T13:00:00.000Z', encodedSave: 'broken-payload' }),
  });

  const slots = readManualSaveSlots(storage).slots;
  assert.equal(getSlot(slots, 2).status, 'corrupt');
  assert.equal(getSlot(slots, 3).status, 'corrupt');
  assert.match(getSlot(slots, 2).error, /date|timestamp/i);
  assert.match(getSlot(slots, 3).error, /save|corrupt|decompress/i);
  assert.equal(getSlot(slots, 1).status, 'empty');

  storage.setItem(MANUAL_SAVE_KEY, validSave);
  const withNeighbor = readManualSaveSlots(storage).slots;
  assert.equal(getSlot(withNeighbor, 1).status, 'saved');
  assert.equal(getSlot(withNeighbor, 2).status, 'corrupt');
  assert.equal(getSlot(withNeighbor, 3).status, 'corrupt');
});

test('storage read failures are isolated to the affected slot', () => {
  const values = new Map([
    [MANUAL_SAVE_KEY, createSave(1)],
    [slotThreeKey, createSlotEnvelope(3, createSave(3))],
  ]);
  const storage = {
    getItem(key) {
      if (key === slotTwoKey) throw new Error('storage blocked for Slot 2');
      return values.get(key) ?? null;
    },
  };

  const slots = readManualSaveSlots(storage).slots;
  assert.equal(getSlot(slots, 1).status, 'saved');
  assert.equal(getSlot(slots, 2).status, 'unavailable');
  assert.equal(getSlot(slots, 3).status, 'saved');
  assert.match(getSlot(slots, 2).error, /storage/i);
});

test('invalid payloads and failed writes leave existing slot and unrelated game data unchanged', () => {
  const previousSave = createSave(2);
  const autoSave = createSave(6);
  const backup = createSave(7);
  const recovery = 'recovery-payload';
  const preferences = JSON.stringify({ version: 1, textScale: 1.125, reduceMotion: true });
  const storage = createMemoryStorage({
    [MANUAL_SAVE_KEY]: previousSave,
    [AUTO_SAVE_KEY]: autoSave,
    [BACKUP_SAVE_KEY]: backup,
    [RECOVERY_SAVE_KEY]: recovery,
    [PREFERENCES_STORAGE_KEY]: preferences,
  });

  assert.equal(saveManualSaveSlot(storage, 1, 'not-a-compressed-save', { overwriteConfirmed: true }).status, 'invalid-save');
  assert.equal(storage.getItem(MANUAL_SAVE_KEY), previousSave);

  const originalSetItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === slotTwoKey) throw new Error('quota exceeded');
    originalSetItem(key, value);
  };
  assert.equal(saveManualSaveSlot(storage, 2, createSave(9)).status, 'unavailable');
  assert.equal(storage.getItem(slotTwoKey), null);
  assert.equal(storage.getItem(MANUAL_SAVE_KEY), previousSave);
  assert.equal(storage.getItem(AUTO_SAVE_KEY), autoSave);
  assert.equal(storage.getItem(BACKUP_SAVE_KEY), backup);
  assert.equal(storage.getItem(RECOVERY_SAVE_KEY), recovery);
  assert.equal(storage.getItem(PREFERENCES_STORAGE_KEY), preferences);
});

test('deleting a slot requires confirmation and a confirmed delete leaves other slots unchanged', () => {
  const slotOne = createSave(1);
  const slotTwo = createSlotEnvelope(2, createSave(2));
  const storage = createMemoryStorage({
    [MANUAL_SAVE_KEY]: slotOne,
    [slotTwoKey]: slotTwo,
  });

  assert.equal(deleteManualSaveSlot(storage, 1).status, 'confirmation-required');
  assert.equal(storage.getItem(MANUAL_SAVE_KEY), slotOne);

  assert.equal(deleteManualSaveSlot(storage, 1, { confirmed: true }).status, 'deleted');
  assert.equal(storage.getItem(MANUAL_SAVE_KEY), null);
  assert.equal(storage.getItem(slotTwoKey), slotTwo, 'deleting Slot 1 must leave Slot 2 untouched');
  assert.equal(getSlot(readManualSaveSlots(storage).slots, 1).status, 'empty');
  assert.equal(getSlot(readManualSaveSlots(storage).slots, 2).status, 'saved');
});

test('failed writes and deletes report storage unavailable without clearing saved data', () => {
  const existing = createSlotEnvelope(2, createSave(4));
  const storage = createMemoryStorage({ [slotTwoKey]: existing });
  storage.setItem = () => { throw new Error('quota exceeded'); };
  storage.removeItem = () => { throw new Error('storage blocked'); };

  assert.equal(saveManualSaveSlot(storage, 2, createSave(10), { overwriteConfirmed: true }).status, 'unavailable');
  assert.equal(deleteManualSaveSlot(storage, 2, { confirmed: true }).status, 'unavailable');
  assert.equal(storage.getItem(slotTwoKey), existing);
});

test('only the three supported slot IDs can be changed', () => {
  const storage = createMemoryStorage();
  for (const slotId of [0, 4, '1', null]) {
    assert.equal(saveManualSaveSlot(storage, slotId, createSave()).status, 'invalid-slot');
    assert.equal(deleteManualSaveSlot(storage, slotId, { confirmed: true }).status, 'invalid-slot');
  }
  assert.deepEqual(readManualSaveSlots(storage).slots.map(({ slotId }) => slotId), slotIds);
  assert.equal(storage.values.size, 0);
});
