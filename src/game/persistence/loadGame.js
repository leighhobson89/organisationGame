import { decodeSave } from './save.js';
import { createNewGameState, normalizeGameState, normalizeGameStateWithMigration } from './gameState.js';

export const AUTO_SAVE_KEY = 'palimpsest-laboratory.autosave.v1';
export const BACKUP_SAVE_KEY = 'palimpsest-laboratory.backup.v1';
export const MANUAL_SAVE_KEY = 'palimpsest-laboratory.manual.v1';
export const RECOVERY_SAVE_KEY = 'palimpsest-laboratory.recovery.v1';

function preserveRaw(storage, recoveryKey, raw) {
  try {
    const current = storage.getItem(recoveryKey);
    if (current === raw) return true;
    if (current === null) {
      storage.setItem(recoveryKey, raw);
      return storage.getItem(recoveryKey) === raw;
    }

    for (let suffix = 1; suffix <= 5; suffix += 1) {
      const candidateKey = `${recoveryKey}.${suffix}`;
      const candidate = storage.getItem(candidateKey);
      if (candidate === raw) return true;
      if (candidate === null) {
        storage.setItem(candidateKey, raw);
        return storage.getItem(candidateKey) === raw;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function readValidState(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return normalizeGameState(decodeSave(raw));
  } catch {
    return null;
  }
}

/** Load a saved game without overwriting a damaged autosave during recovery. */
export function loadGameFromStorage(storage, {
  autoSaveKey = AUTO_SAVE_KEY,
  backupKey = BACKUP_SAVE_KEY,
  recoveryKey = RECOVERY_SAVE_KEY,
  createNewGame = createNewGameState,
} = {}) {
  let rawAutosave;
  try {
    rawAutosave = storage?.getItem(autoSaveKey) ?? null;
  } catch {
    return {
      state: createNewGame(),
      autosaveEnabled: true,
      canEnableAutosave: false,
      notice: 'Browser storage is unavailable. This laboratory can be played, but autosave may not work.',
    };
  }

  if (!rawAutosave) {
    return { state: createNewGame(), autosaveEnabled: true, canEnableAutosave: false, notice: null };
  }

  try {
    const decoded = decodeSave(rawAutosave);
    const normalized = normalizeGameStateWithMigration(decoded);
    if (normalized.migratedFromVersion) {
      const preserved = preserveRaw(storage, recoveryKey, rawAutosave);
      const salvageMessage = normalized.salvagedCount > 0
        ? ` ${normalized.salvagedCount} over-capacity object${normalized.salvagedCount === 1 ? ' was' : 's were'} returned to the workspace.`
        : '';
      return {
        state: normalized.state,
        autosaveEnabled: preserved,
        canEnableAutosave: false,
        notice: preserved
          ? `The laboratory save was upgraded to the current format. The original save was preserved in recovery storage.${salvageMessage}`
          : 'The laboratory save was upgraded in memory, but its original could not be preserved in recovery storage. Autosaving is paused to protect it.',
      };
    }
    return { state: normalized.state, autosaveEnabled: true, canEnableAutosave: false, notice: null };
  } catch {
    const preservedAutosave = preserveRaw(storage, recoveryKey, rawAutosave);
    let rawBackup = null;
    try { rawBackup = storage.getItem(backupKey); } catch { /* Preserve the autosave even if backup access fails. */ }

    if (rawBackup) {
      const recoveredState = readValidState(storage, backupKey);
      if (recoveredState) {
        if (preservedAutosave) {
          return {
            state: recoveredState,
            autosaveEnabled: true,
            canEnableAutosave: false,
            notice: 'The autosave could not be read. The laboratory was recovered from its backup, and the original autosave was preserved in recovery storage.',
          };
        }
        return {
          state: recoveredState,
          autosaveEnabled: false,
          canEnableAutosave: false,
          notice: 'The autosave could not be read and could not be preserved safely. A backup was loaded, but autosaving remains paused.',
        };
      }
      preserveRaw(storage, `${recoveryKey}.backup`, rawBackup);
    }

    return {
      state: createNewGame(),
      autosaveEnabled: false,
      canEnableAutosave: preservedAutosave,
      notice: preservedAutosave
        ? 'The autosave could not be restored. Its original data has been preserved in local recovery storage. Import a valid save or explicitly start a fresh laboratory.'
        : 'The autosave could not be restored or preserved. Autosave remains paused to protect the saved data.',
    };
  }
}
