import LZString from 'lz-string';
import {
  CURRENT_GAME_STATE_VERSION,
  LEGACY_GAME_STATE_VERSION,
  PREVIOUS_GAME_STATE_VERSION,
  normalizeGameStateWithMigration,
} from './gameState.js';

export const CURRENT_SAVE_VERSION = CURRENT_GAME_STATE_VERSION;
export const LEGACY_SAVE_VERSION = LEGACY_GAME_STATE_VERSION;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateSaveState(state, { allowLegacy = false } = {}) {
  if (!isPlainObject(state)) {
    throw new TypeError('Save data must be a JSON object.');
  }

  if (!Number.isInteger(state.version)) {
    throw new TypeError('Save data must include an integer version.');
  }

  const isSupportedLegacy = allowLegacy
    && [LEGACY_SAVE_VERSION, PREVIOUS_GAME_STATE_VERSION].includes(state.version);
  if (state.version !== CURRENT_SAVE_VERSION && !isSupportedLegacy) {
    throw new Error(`Unsupported save version: ${state.version}.`);
  }

  if (state.items !== undefined && !Array.isArray(state.items)) {
    throw new TypeError('Save items must be an array.');
  }

  return state;
}

export function encodeSave(state) {
  validateSaveState(state);
  const json = JSON.stringify(state);
  if (typeof json !== 'string') throw new TypeError('Save data could not be serialized.');
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeSave(compressedSave) {
  if (typeof compressedSave !== 'string' || compressedSave.length === 0) {
    throw new TypeError('Compressed save data must be a non-empty string.');
  }

  const json = LZString.decompressFromEncodedURIComponent(compressedSave);
  if (typeof json !== 'string' || json.length === 0) {
    throw new Error('Save data is corrupt or cannot be decompressed.');
  }

  let state;
  try {
    state = JSON.parse(json);
  } catch (error) {
    throw new Error('Save data is not valid JSON.', { cause: error });
  }

  return validateSaveState(state, { allowLegacy: true });
}

/**
 * Decode an imported save without changing the current state on any failure.
 * The caller should create a local backup before installing a successful state.
 */
export function importSave(compressedSave, currentState) {
  try {
    const decodedState = decodeSave(compressedSave);
    const normalized = normalizeGameStateWithMigration(decodedState);
    if (!normalized.migratedFromVersion) return { ok: true, state: normalized.state };

    const salvageMessage = normalized.salvagedCount > 0
      ? ` ${normalized.salvagedCount} over-capacity object${normalized.salvagedCount === 1 ? ' was' : 's were'} returned to the workspace.`
      : '';
    return {
      ok: true,
      state: normalized.state,
      migratedFromVersion: normalized.migratedFromVersion,
      salvagedCount: normalized.salvagedCount,
      notice: `The imported laboratory was upgraded to the current format.${salvageMessage}`,
    };
  } catch (error) {
    return {
      ok: false,
      state: currentState,
      error: error instanceof Error ? error.message : 'Unable to import save data.',
    };
  }
}
