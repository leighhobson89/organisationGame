import { MANUAL_SAVE_KEY } from './loadGame.js';
import { importSave } from './save.js';

const SLOT_IDS = Object.freeze([1, 2, 3]);
const SLOT_KEYS = Object.freeze({
  1: MANUAL_SAVE_KEY,
  2: 'palimpsest-laboratory.manual.slot-2.v1',
  3: 'palimpsest-laboratory.manual.slot-3.v1',
});
const ENVELOPE_VERSION = 1;

function resolveStorage(storage) {
  if (storage !== undefined) return storage;

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function unavailableSlot(slotId, error) {
  return {
    slotId,
    status: 'unavailable',
    error: error instanceof Error ? error.message : 'Browser storage is unavailable.',
  };
}

function corruptSlot(slotId, error) {
  return {
    slotId,
    status: 'corrupt',
    error: error instanceof Error ? error.message : String(error || 'The saved slot is malformed.'),
  };
}

function validateEncodedSave(encodedSave) {
  if (typeof encodedSave !== 'string' || encodedSave.length === 0) {
    return { ok: false, error: 'Save data must be a non-empty compressed string.' };
  }

  const result = importSave(encodedSave, null);
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error };
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function readSlot(storage, slotId) {
  const key = SLOT_KEYS[slotId];
  let raw;

  try {
    raw = storage.getItem(key);
  } catch (error) {
    return unavailableSlot(slotId, error);
  }

  if (raw === null || raw === undefined) {
    return { slotId, status: 'empty' };
  }
  if (typeof raw !== 'string' || raw.length === 0) {
    return corruptSlot(slotId, 'The saved slot is empty or malformed.');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Before slots existed, MANUAL_SAVE_KEY stored the compressed string directly.
    if (slotId === 1) {
      const legacyValidation = validateEncodedSave(raw);
      if (legacyValidation.ok) {
        return {
          slotId,
          status: 'saved',
          encodedSave: raw,
          savedAt: null,
          legacy: true,
        };
      }
      return corruptSlot(slotId, legacyValidation.error);
    }
    return corruptSlot(slotId, 'The saved slot envelope is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return corruptSlot(slotId, 'The saved slot envelope must be an object.');
  }
  if (parsed.version !== ENVELOPE_VERSION) {
    return corruptSlot(slotId, `Unsupported manual save slot version: ${String(parsed.version)}.`);
  }
  if (parsed.slotId !== slotId) {
    return corruptSlot(slotId, 'The saved slot ID does not match its storage slot.');
  }
  if (!isIsoTimestamp(parsed.savedAt)) {
    return corruptSlot(slotId, 'The saved slot timestamp is invalid.');
  }

  const saveValidation = validateEncodedSave(parsed.encodedSave);
  if (!saveValidation.ok) {
    return corruptSlot(slotId, saveValidation.error);
  }

  return {
    slotId,
    status: 'saved',
    encodedSave: parsed.encodedSave,
    savedAt: parsed.savedAt,
    legacy: false,
  };
}

function isValidSlotId(slotId) {
  return SLOT_IDS.includes(slotId);
}

function result(status, error) {
  return error ? { status, error } : { status };
}

function getTimestamp(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid save timestamp could not be created.');
  return date.toISOString();
}

function restoreStoredValue(storage, key, previousValue) {
  try {
    if (previousValue === null || previousValue === undefined) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, previousValue);
    }
  } catch {
    // Web Storage mutations are atomic in browsers. This is a best-effort fallback
    // for storage adapters that throw after partially applying a mutation.
  }
}

/** Read each local slot independently so one damaged record cannot hide another. */
export function readManualSaveSlots(storage) {
  const source = resolveStorage(storage);
  if (!source || typeof source.getItem !== 'function') {
    return {
      slots: SLOT_IDS.map((slotId) => unavailableSlot(slotId, 'Browser storage is unavailable.')),
    };
  }

  return { slots: SLOT_IDS.map((slotId) => readSlot(source, slotId)) };
}

/** Store a validated compressed game snapshot in one of the three manual slots. */
export function saveManualSaveSlot(storage, slotId, encodedSave, {
  overwriteConfirmed = false,
  now = () => new Date(),
} = {}) {
  if (!isValidSlotId(slotId)) return result('invalid-slot', 'Choose one of the three manual save slots.');

  const destination = resolveStorage(storage);
  if (!destination || typeof destination.getItem !== 'function' || typeof destination.setItem !== 'function') {
    return result('unavailable', 'Browser storage is unavailable.');
  }

  const key = SLOT_KEYS[slotId];
  let previousValue;
  try {
    previousValue = destination.getItem(key);
  } catch (error) {
    return result('unavailable', error instanceof Error ? error.message : 'Browser storage is unavailable.');
  }

  if (previousValue !== null && previousValue !== undefined && !overwriteConfirmed) {
    return result('confirmation-required');
  }

  const validation = validateEncodedSave(encodedSave);
  if (!validation.ok) return result('invalid-save', validation.error);

  let envelope;
  try {
    envelope = JSON.stringify({
      version: ENVELOPE_VERSION,
      slotId,
      savedAt: getTimestamp(now),
      encodedSave,
    });
  } catch (error) {
    return result('unavailable', error instanceof Error ? error.message : 'A save timestamp could not be created.');
  }

  try {
    destination.setItem(key, envelope);
    if (destination.getItem(key) !== envelope) {
      throw new Error('The saved slot could not be verified after writing.');
    }
    return result('saved');
  } catch (error) {
    restoreStoredValue(destination, key, previousValue);
    return result('unavailable', error instanceof Error ? error.message : 'The saved slot could not be written.');
  }
}

/** Delete a populated slot only after the player confirms the action. */
export function deleteManualSaveSlot(storage, slotId, { confirmed = false } = {}) {
  if (!isValidSlotId(slotId)) return result('invalid-slot', 'Choose one of the three manual save slots.');

  const destination = resolveStorage(storage);
  if (!destination || typeof destination.getItem !== 'function' || typeof destination.removeItem !== 'function') {
    return result('unavailable', 'Browser storage is unavailable.');
  }

  const key = SLOT_KEYS[slotId];
  let previousValue;
  try {
    previousValue = destination.getItem(key);
  } catch (error) {
    return result('unavailable', error instanceof Error ? error.message : 'Browser storage is unavailable.');
  }

  if (previousValue === null || previousValue === undefined) return result('deleted');
  if (!confirmed) return result('confirmation-required');

  try {
    destination.removeItem(key);
    if (destination.getItem(key) !== null) {
      throw new Error('The saved slot could not be verified after deletion.');
    }
    return result('deleted');
  } catch (error) {
    restoreStoredValue(destination, key, previousValue);
    return result('unavailable', error instanceof Error ? error.message : 'The saved slot could not be deleted.');
  }
}
