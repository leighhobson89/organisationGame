import { useCallback, useEffect, useRef, useState } from 'react';
import { createAutosaveCoordinator } from '../game/persistence/autosaveCoordinator.js';
import { AUTO_SAVE_KEY, BACKUP_SAVE_KEY, loadGameFromStorage } from '../game/persistence/loadGame.js';
import { createNewGameState } from '../game/persistence/gameState.js';
import { encodeSave, importSave } from '../game/persistence/save.js';

export function useGamePersistence() {
  const [initialLoad] = useState(() => {
    try {
      return loadGameFromStorage(window.localStorage, { createNewGame: createNewGameState });
    } catch {
      return {
        state: createNewGameState(),
        autosaveEnabled: true,
        canEnableAutosave: false,
        notice: 'Browser storage is unavailable. This laboratory can be played, but autosave may not work.',
      };
    }
  });
  const [game, setGame] = useState(initialLoad.state);
  const [autosaveEnabled, setAutosaveEnabled] = useState(initialLoad.autosaveEnabled);
  const [canStartFresh, setCanStartFresh] = useState(initialLoad.canEnableAutosave ?? false);
  const [recoveryNotice, setRecoveryNotice] = useState(initialLoad.notice);
  const [saveStatus, setSaveStatus] = useState(initialLoad.autosaveEnabled ? 'Checking autosave\u2026' : 'Recovery needed');
  const [saveText, setSaveText] = useState('');
  const autosaveCoordinatorRef = useRef(null);

  const updateGame = useCallback((nextGame) => {
    autosaveCoordinatorRef.current?.invalidate();
    setGame(nextGame);
  }, []);

  useEffect(() => {
    let worker = null;
    let storage = null;
    try {
      if (typeof Worker !== 'undefined') {
        worker = new Worker(new URL('../game/persistence/autosaveEncoder.worker.js', import.meta.url), { type: 'module' });
      }
    } catch {
      worker = null;
    }
    try { storage = window.localStorage; } catch { storage = null; }

    const coordinator = createAutosaveCoordinator({
      worker,
      storage,
      autoSaveKey: AUTO_SAVE_KEY,
      onStatus: setSaveStatus,
    });
    autosaveCoordinatorRef.current = coordinator;
    return () => {
      coordinator.dispose();
      if (autosaveCoordinatorRef.current === coordinator) autosaveCoordinatorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const coordinator = autosaveCoordinatorRef.current;
    if (!coordinator) return;
    if (!autosaveEnabled) {
      coordinator.invalidate();
      setSaveStatus('Recovery needed');
      return;
    }
    coordinator.schedule(game);
  }, [autosaveEnabled, game]);

  useEffect(() => {
    if (saveStatus !== 'Saving…') return;

    const confirmPendingSave = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', confirmPendingSave);
    return () => window.removeEventListener('beforeunload', confirmPendingSave);
  }, [saveStatus]);

  const openSaveDialog = useCallback(() => {
    try { setSaveText(encodeSave(game)); } catch { setSaveText(''); }
  }, [game]);

  const importGame = useCallback((compressed, beforeApply = () => {}) => {
    const result = importSave(compressed, game);
    if (!result.ok) return result;

    const importedState = result.state;
    try {
      window.localStorage.setItem(BACKUP_SAVE_KEY, encodeSave(game));
    } catch {
      return { ok: false, state: game, error: 'The current laboratory could not be backed up, so the import was not applied.' };
    }

    beforeApply(importedState);
    updateGame(importedState);
    try { setSaveText(encodeSave(importedState)); } catch { setSaveText(''); }
    setAutosaveEnabled(true);
    setCanStartFresh(false);
    setRecoveryNotice(null);
    return result;
  }, [game, updateGame]);

  const startNewGame = useCallback((beforeApply = () => {}) => {
    if (!autosaveEnabled) {
      return {
        ok: false,
        state: game,
        error: 'Autosave is paused while this laboratory needs recovery. Use the Start fresh laboratory action before starting over.',
      };
    }

    let freshState;
    let freshSave;
    let storage;
    let previousAutosave = null;
    let commitStep = 'backup';

    try {
      freshState = createNewGameState();
      const previousSave = encodeSave(game);
      freshSave = encodeSave(freshState);
      storage = window.localStorage;
      previousAutosave = storage.getItem(AUTO_SAVE_KEY);
      storage.setItem(BACKUP_SAVE_KEY, previousSave);
      if (storage.getItem(BACKUP_SAVE_KEY) !== previousSave) {
        throw new Error('The current laboratory backup could not be verified.');
      }

      commitStep = 'fresh-save';
      storage.setItem(AUTO_SAVE_KEY, freshSave);
      if (storage.getItem(AUTO_SAVE_KEY) !== freshSave) {
        throw new Error('The new laboratory save could not be verified.');
      }
    } catch {
      if (commitStep === 'fresh-save' && storage) {
        try {
          if (previousAutosave === null) storage.removeItem(AUTO_SAVE_KEY);
          else storage.setItem(AUTO_SAVE_KEY, previousAutosave);
        } catch {
          // A failed replacement must not prevent the live game from staying open.
        }
      }
      return {
        ok: false,
        state: game,
        error: commitStep === 'backup'
          ? 'Start Over was canceled because the current laboratory could not be backed up. Your progress and manual save slots are unchanged.'
          : 'The new laboratory could not be saved, so the current laboratory remains open. A backup of your progress was kept; manual save slots are unchanged.',
      };
    }

    autosaveCoordinatorRef.current?.invalidate();
    beforeApply(freshState);
    setGame(freshState);
    setAutosaveEnabled(true);
    setCanStartFresh(false);
    setRecoveryNotice(null);
    setSaveText(freshSave);
    setSaveStatus('Saved just now');
    return { ok: true, state: freshState };
  }, [autosaveEnabled, game]);

  const startFresh = useCallback(() => {
    if (!canStartFresh) return false;
    setAutosaveEnabled(true);
    setCanStartFresh(false);
    setRecoveryNotice(null);
    return true;
  }, [canStartFresh]);

  const dismissRecoveryNotice = useCallback(() => setRecoveryNotice(null), []);

  return {
    game,
    updateGame,
    autosaveEnabled,
    canStartFresh,
    recoveryNotice,
    saveStatus,
    saveText,
    openSaveDialog,
    importGame,
    startNewGame,
    startFresh,
    dismissRecoveryNotice,
  };
}
