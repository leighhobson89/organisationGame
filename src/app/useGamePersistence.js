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
    startFresh,
    dismissRecoveryNotice,
  };
}
