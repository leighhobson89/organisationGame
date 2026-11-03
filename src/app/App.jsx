import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CHAPTER_COLLECTION_IDS, COLLECTIONS, DESTINATIONS, getScratchPadsForOwnedSkills, NOTEBOOK_DISCOVERIES, PUZZLES, SKILLS, WORLD_BOUNDS } from '../game/content/catalog.js';
import { emitGameAudioEvent } from '../game/audio/audioEvents.js';
import { createWebAudioAdapter } from '../game/audio/webAudioAdapter.js';
import { getCompletionStats, isGameComplete } from '../game/domain/completion.js';
import { completeCollection, findMissingCollectionMember } from '../game/domain/progression.js';
import { validateDrop } from '../game/domain/placement.js';
import { createNewGameState, DEFAULT_GAME_ITEM_IDS, getCanonicalItemRotation } from '../game/persistence/gameState.js';
import { createAutosaveCoordinator } from '../game/persistence/autosaveCoordinator.js';
import { AUTO_SAVE_KEY, BACKUP_SAVE_KEY, loadGameFromStorage } from '../game/persistence/loadGame.js';
import { loadPreferences, normalizePreferences, savePreferences } from '../game/preferences/preferences.js';
import { encodeSave, importSave } from '../game/persistence/save.js';
import { allocateBatchTargetPlacements, allocateTargetPlacement } from '../game/world/placementLayout.js';
import { CompletionSequence } from '../ui/CompletionSequence.jsx';
import { ItemInspector } from '../ui/ItemInspector.jsx';
import { NotebookPanel } from '../ui/NotebookPanel.jsx';
import { PuzzlePanel } from '../ui/PuzzlePanel.jsx';
import { SaveDialog } from '../ui/SaveDialog.jsx';
import { SettingsDialog } from '../ui/SettingsDialog.jsx';
import { SkillsPanel } from '../ui/SkillsPanel.jsx';
import { WorldViewport } from '../ui/WorldViewport.jsx';

const RESONANCE_LENS_ID = 'resonance-lens';
const RESONANCE_LENS = SKILLS.find((skill) => skill.id === RESONANCE_LENS_ID) ?? { cost: 1, durationMs: 7000 };
const MISSING_MEMBER_COMPASS_ID = 'missing-member-compass';
const AETHER_WAYFINDER_ID = 'aether-wayfinder';
const AETHER_WAYFINDER = SKILLS.find((skill) => skill.id === AETHER_WAYFINDER_ID) ?? { cost: 2, durationMs: 7000 };
const CHAPTER_COLLECTIONS = COLLECTIONS.filter((collection) => CHAPTER_COLLECTION_IDS.includes(collection.id));
const MAX_BATCH_SELECTION = 40;

function collectionIsComplete(collection, items) {
  const itemIds = collection.itemIds ?? [];
  return itemIds.length > 0 && itemIds.every((id) => {
    const item = items.find((entry) => entry.id === id);
    return item?.validation === 'correct'
      && item.placement?.kind === 'destination'
      && (item.placement.destinationId ?? item.placement.id) === collection.destinationId;
  });
}

function isCorrectlyFiled(item) {
  return Boolean(item
    && item.validation === 'correct'
    && item.placement?.kind === 'destination'
    && (item.placement.destinationId ?? item.placement.id) === item.correctDestinationId);
}

function keepPositionInsideWorld(position, item) {
  const width = item.width ?? 0;
  const height = item.height ?? 0;
  return {
    x: Math.max(WORLD_BOUNDS.x, Math.min(WORLD_BOUNDS.x + WORLD_BOUNDS.width - width, position.x)),
    y: Math.max(WORLD_BOUNDS.y, Math.min(WORLD_BOUNDS.y + WORLD_BOUNDS.height - height, position.y)),
  };
}

function objectProgressPercent(items) {
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.validation === 'correct').length / items.length) * 100);
}

function nextInventionStage(currentStage, rewardedStage) {
  const candidate = rewardedStage === 'memory-crystal' ? 'Memory Crystal' : rewardedStage;
  const stageOrder = { Dormant: 0, 'Memory Crystal': 1, 'Chronology Wheel': 2 };
  const currentRank = stageOrder[currentStage] ?? -1;
  const candidateRank = stageOrder[candidate] ?? -1;
  return candidateRank > currentRank ? candidate : currentStage;
}

export default function App() {
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
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [multiSelectionMode, setMultiSelectionMode] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [preferences, setPreferences] = useState(() => loadPreferences());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferencesStatus, setPreferencesStatus] = useState('');
  const [keyboardFocusItemId, setKeyboardFocusItemId] = useState(null);
  const [activeLeftPanel, setActiveLeftPanel] = useState(null);
  const [activeRightPanel, setActiveRightPanel] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(initialLoad.autosaveEnabled);
  const [canStartFresh, setCanStartFresh] = useState(initialLoad.canEnableAutosave ?? false);
  const [recoveryNotice, setRecoveryNotice] = useState(initialLoad.notice);
  const [saveStatus, setSaveStatus] = useState(initialLoad.autosaveEnabled ? 'Checking autosave…' : 'Recovery needed');
  const [saveText, setSaveText] = useState('');
  const [toast, setToast] = useState('');
  const [lensActive, setLensActive] = useState(false);
  const [lensMessage, setLensMessage] = useState('');
  const [missingMemberId, setMissingMemberId] = useState(null);
  const [guidedDestination, setGuidedDestination] = useState(null);
  const [activePuzzleId, setActivePuzzleId] = useState(null);
  const suppressCompletionAudioRef = useRef(false);
  const previousCompletionRef = useRef(isGameComplete({
    items: initialLoad.state.items,
    progress: initialLoad.state.progress,
    collections: COLLECTIONS,
    puzzles: PUZZLES,
    expectedItemIds: DEFAULT_GAME_ITEM_IDS,
  }));
  const worldRef = useRef(null);
  const autosaveCoordinatorRef = useRef(null);
  const documentPreferencesRef = useRef(null);
  const audioAdapterRef = useRef(null);
  const updateGame = (nextGame) => {
    autosaveCoordinatorRef.current?.invalidate();
    setGame(nextGame);
  };
  const selectedItem = game.items.find((item) => item.id === selectedItemId) ?? null;
  const progress = game.progress;
  const scratchPads = useMemo(() => getScratchPadsForOwnedSkills(progress.ownedSkills), [progress.ownedSkills]);
  const unlockedPuzzleIds = progress.unlockedPuzzleIds ?? [];
  const unlockedPuzzles = PUZZLES.filter((puzzle) => unlockedPuzzleIds.includes(puzzle.id)
    && (puzzle.requiresCompletedCollectionIds ?? []).every((collectionId) => {
      const collection = COLLECTIONS.find((entry) => entry.id === collectionId);
      return collection && collectionIsComplete(collection, game.items)
        && (progress.completedCollectionIds ?? []).includes(collectionId);
    }));
  const solvedPuzzleIds = progress.solvedPuzzleIds ?? [];
  const activePuzzle = unlockedPuzzles.find((puzzle) => puzzle.id === activePuzzleId)
    ?? unlockedPuzzles.find((puzzle) => !solvedPuzzleIds.includes(puzzle.id))
    ?? unlockedPuzzles.at(-1)
    ?? null;
  const puzzleSolved = Boolean(activePuzzle && solvedPuzzleIds.includes(activePuzzle.id));
  const chapterCompletedCount = CHAPTER_COLLECTIONS.filter((collection) => (progress.completedCollectionIds ?? []).includes(collection.id)).length;
  const compassCandidateId = useMemo(
    () => selectedItem ? findMissingCollectionMember(game.items, selectedItem.id) : null,
    [game.items, selectedItem?.id],
  );
  const compassActive = Boolean(missingMemberId);
  const wayfinderActive = guidedDestination?.itemId === selectedItemId;
  const activeSkillIds = [
    ...(lensActive ? [RESONANCE_LENS_ID] : []),
    ...(compassActive ? [MISSING_MEMBER_COMPASS_ID] : []),
    ...(wayfinderActive ? [AETHER_WAYFINDER_ID] : []),
  ];
  const canUseSkills = {
    [RESONANCE_LENS_ID]: Boolean(selectedItem),
    [MISSING_MEMBER_COMPASS_ID]: Boolean(compassCandidateId),
    [AETHER_WAYFINDER_ID]: Boolean(selectedItem && !isCorrectlyFiled(selectedItem)),
  };
  const restoredPercent = objectProgressPercent(game.items);
  const gameComplete = useMemo(() => isGameComplete({
    items: game.items,
    progress,
    collections: COLLECTIONS,
    puzzles: PUZZLES,
    expectedItemIds: DEFAULT_GAME_ITEM_IDS,
  }), [game.items, progress]);
  const completionStats = useMemo(() => getCompletionStats({
    items: game.items,
    progress,
    collections: COLLECTIONS,
    puzzles: PUZZLES,
    notebook: game.notebook,
    expectedItemIds: DEFAULT_GAME_ITEM_IDS,
  }), [game.items, progress, game.notebook]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!documentPreferencesRef.current) {
      documentPreferencesRef.current = {
        textScale: root.style.getPropertyValue('--text-scale'),
        textScalePriority: root.style.getPropertyPriority('--text-scale'),
        hadUserReducedMotion: root.hasAttribute('data-user-reduced-motion'),
        userReducedMotion: root.getAttribute('data-user-reduced-motion'),
      };
    }

    root.style.setProperty('--text-scale', String(preferences.textScale));
    if (preferences.reduceMotion) {
      root.setAttribute('data-user-reduced-motion', 'true');
    } else {
      root.removeAttribute('data-user-reduced-motion');
    }

    return () => {
      const original = documentPreferencesRef.current;
      if (!original) return;
      if (original.textScale) root.style.setProperty('--text-scale', original.textScale, original.textScalePriority);
      else root.style.removeProperty('--text-scale');
      if (original.hadUserReducedMotion) root.setAttribute('data-user-reduced-motion', original.userReducedMotion ?? '');
      else root.removeAttribute('data-user-reduced-motion');
    };
  }, [preferences]);

  useEffect(() => {
    if (gameComplete && !previousCompletionRef.current) {
      const suppressAudio = suppressCompletionAudioRef.current;
      suppressCompletionAudioRef.current = false;
      if (!suppressAudio) {
        emitGameAudioEvent('invention.activated', {
          inventionId: 'palimpsest-engine',
          stageId: 'Chronology Wheel',
        });
      }
      setCompletionOpen(true);
    } else if (!gameComplete) {
      suppressCompletionAudioRef.current = false;
    }
    previousCompletionRef.current = gameComplete;
  }, [gameComplete]);

  useEffect(() => {
    let adapter = null;
    try {
      adapter = createWebAudioAdapter({ enabled: preferences.soundEffectsEnabled });
    } catch {
      return undefined;
    }
    audioAdapterRef.current = adapter;
    return () => {
      if (audioAdapterRef.current === adapter) audioAdapterRef.current = null;
      try {
        void Promise.resolve(adapter.dispose()).catch(() => {});
      } catch {
        // Audio cleanup must never interfere with application teardown.
      }
    };
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
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 5200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!lensActive) return undefined;
    const timer = window.setTimeout(() => {
      setLensActive(false);
      setLensMessage('The Resonance Lens has cooled.');
    }, RESONANCE_LENS.durationMs);
    return () => window.clearTimeout(timer);
  }, [lensActive]);

  useEffect(() => {
    if (!guidedDestination) return undefined;
    const timer = window.setTimeout(() => {
      setGuidedDestination(null);
      setLensMessage('The Aether Wayfinder has cooled.');
    }, AETHER_WAYFINDER.durationMs);
    return () => window.clearTimeout(timer);
  }, [guidedDestination]);

  useEffect(() => {
    if (!guidedDestination) return;
    const guidedItem = game.items.find((item) => item.id === guidedDestination.itemId);
    if (selectedItemId !== guidedDestination.itemId || !guidedItem || isCorrectlyFiled(guidedItem)) {
      setGuidedDestination(null);
      if (guidedItem && isCorrectlyFiled(guidedItem)) setLensMessage('The object has reached its destination. The Aether Wayfinder is idle.');
    }
  }, [game.items, guidedDestination, selectedItemId]);

  useEffect(() => {
    if (!missingMemberId || !selectedItemId) return;
    const nextMissingMemberId = findMissingCollectionMember(game.items, selectedItemId);
    if (nextMissingMemberId !== missingMemberId) setMissingMemberId(nextMissingMemberId);
  }, [game.items, missingMemberId, selectedItemId]);

  const handleCameraChange = (camera) => {
    updateGame((current) => ({ ...current, camera }));
  };

  const handleDrop = (itemId, target, position) => {
    const item = game.items.find((entry) => entry.id === itemId);
    if (!item) return null;
    const desiredPosition = position ? keepPositionInsideWorld(position, item) : undefined;
    const allocation = allocateTargetPlacement({
      target,
      item,
      items: game.items,
      destinations: DESTINATIONS,
      scratchPads,
      preferredPosition: desiredPosition
        ? target.kind === 'workspace'
          ? desiredPosition
          : { x: desiredPosition.x + (item.width ?? 0) / 2, y: desiredPosition.y + (item.height ?? 0) / 2 }
        : undefined,
    });
    if (!allocation.ok) {
      setToast(allocation.reason);
      return null;
    }

    const nextPosition = keepPositionInsideWorld(allocation.position, item);
    const allocatedTarget = { ...target, ...(Number.isInteger(allocation.slotIndex) ? { slotIndex: allocation.slotIndex } : {}) };
    const validation = validateDrop(item, allocatedTarget);
    const movedItem = {
      ...item,
      position: nextPosition,
      placement: allocation.placement,
      rotation: allocation.placement.kind === 'workspace' ? getCanonicalItemRotation(item.id, game.contentSeed) : 0,
      validation: validation.status,
      previousWorkspacePosition: target.kind === 'workspace'
        ? nextPosition
        : target.kind === 'destination' && item.placement?.kind === 'workspace'
          ? item.position
          : item.previousWorkspacePosition ?? item.position,
    };
    const items = game.items.map((entry) => entry.id === itemId ? movedItem : entry);
    let nextProgress = game.progress;
    let newlyCompleted = null;
    const newlyCompletedCollections = [];
    const previouslyUnlockedPuzzleIds = new Set(nextProgress.unlockedPuzzleIds ?? []);
    for (const collection of COLLECTIONS) {
      if (collectionIsComplete(collection, items) && !(nextProgress.completedCollectionIds ?? []).includes(collection.id)) {
        nextProgress = completeCollection(nextProgress, collection);
        newlyCompleted = collection;
        newlyCompletedCollections.push(collection);
      }
    }
    const newlyUnlockedPuzzle = PUZZLES.find((puzzle) => (nextProgress.unlockedPuzzleIds ?? []).includes(puzzle.id)
      && !previouslyUnlockedPuzzleIds.has(puzzle.id));
    const notebookDiscoveries = [...(game.notebook?.discoveries ?? [])];
    if (newlyCompleted?.discoveryId && !notebookDiscoveries.includes(newlyCompleted.discoveryId)) {
      notebookDiscoveries.push(newlyCompleted.discoveryId);
    }
    updateGame((current) => ({
      ...current,
      items,
      progress: nextProgress,
      notebook: { ...(current.notebook ?? {}), discoveries: notebookDiscoveries },
    }));
    if (validation.status === 'correct') {
      emitGameAudioEvent('item.placement.correct', {
        itemId,
        targetKind: target.kind,
        ...(target.id ? { targetId: target.id } : {}),
      });
    } else if (validation.status === 'invalid') {
      emitGameAudioEvent('item.placement.invalid', {
        itemId,
        targetKind: target.kind,
        ...(target.id ? { targetId: target.id } : {}),
      });
    }
    for (const collection of newlyCompletedCollections) {
      emitGameAudioEvent('collection.completed', { collectionId: collection.id });
    }
    if (newlyUnlockedPuzzle) {
      emitGameAudioEvent('puzzle.discovered', { puzzleId: newlyUnlockedPuzzle.id });
    }
    setSelectedItemId(itemId);
    setActiveRightPanel(newlyUnlockedPuzzle ? 'puzzle' : 'inspector');

    if (validation.status === 'correct') {
      setToast('Filed correctly. The brass index clicks into place.');
    } else if (validation.status === 'invalid') {
      setToast('Misfiled. The object remains where you left it; move it again when you are ready.');
    } else if (target.kind === 'scratchpad') {
      setToast('Placed on the work surface. This is a temporary arrangement, not a final filing.');
    }

    if (newlyCompleted) {
      const isChapterCollection = CHAPTER_COLLECTION_IDS.includes(newlyCompleted.id);
      if (newlyUnlockedPuzzle) {
        setActivePuzzleId(newlyUnlockedPuzzle.id);
        setActiveRightPanel('puzzle');
        setToast(`${newlyCompleted.label} restored. ${newlyUnlockedPuzzle.title} is now available.`);
      } else {
        setActiveRightPanel('inspector');
        if (isChapterCollection) {
          const restoredChapterCollections = (nextProgress.completedCollectionIds ?? []).filter((id) => CHAPTER_COLLECTION_IDS.includes(id)).length;
          setToast(`${newlyCompleted.label} restored. ${restoredChapterCollections} of ${CHAPTER_COLLECTION_IDS.length} research collections restored.`);
        } else {
          setToast(`${newlyCompleted.label} restored. One insight point earned.`);
        }
      }
      setActiveLeftPanel('notebook');
    }
    return movedItem;
  };

  const handleInspectorMove = (item, target) => {
    const movedItem = handleDrop(item.id, target);
    if (!movedItem) return false;

    if (target.kind === 'destination') {
      const destination = DESTINATIONS.find((entry) => entry.id === target.id);
      if (destination) worldRef.current?.focusDestination(destination, target.id === 'cabinet-calibration' ? 0.5 : undefined);
      return true;
    }
    if (target.kind === 'scratchpad') {
      const pad = scratchPads.find((entry) => entry.id === target.id);
      if (pad) worldRef.current?.focusScratchPad(pad);
      return true;
    }

    worldRef.current?.focusItem(movedItem);
    return true;
  };

  const handleBatchInspectorMove = (batchItems, target) => {
    const itemIds = batchItems.map((item) => item.id);
    const allocationResult = allocateBatchTargetPlacements({
      target,
      itemIds,
      items: game.items,
      destinations: DESTINATIONS,
      scratchPads,
    });
    if (!allocationResult.ok) {
      setToast(allocationResult.reason);
      return false;
    }

    const allocationById = new Map(allocationResult.allocations.map((allocation) => [allocation.itemId, allocation]));
    const movedItems = [];
    const items = game.items.map((item) => {
      const allocation = allocationById.get(item.id);
      if (!allocation) return item;

      const nextPosition = keepPositionInsideWorld(allocation.position, item);
      const allocatedTarget = {
        ...target,
        ...(Number.isInteger(allocation.slotIndex) ? { slotIndex: allocation.slotIndex } : {}),
      };
      const validation = validateDrop(item, allocatedTarget);
      const movedItem = {
        ...item,
        position: nextPosition,
        placement: allocation.placement,
        rotation: allocation.placement.kind === 'workspace' ? getCanonicalItemRotation(item.id, game.contentSeed) : 0,
        validation: validation.status,
        previousWorkspacePosition: target.kind === 'workspace'
          ? nextPosition
          : target.kind === 'destination' && item.placement?.kind === 'workspace'
            ? item.position
            : item.previousWorkspacePosition ?? item.position,
      };
      movedItems.push(movedItem);
      return movedItem;
    });

    let nextProgress = game.progress;
    const newlyCompletedCollections = [];
    const previouslyUnlockedPuzzleIds = new Set(nextProgress.unlockedPuzzleIds ?? []);
    for (const collection of COLLECTIONS) {
      if (collectionIsComplete(collection, items) && !(nextProgress.completedCollectionIds ?? []).includes(collection.id)) {
        nextProgress = completeCollection(nextProgress, collection);
        newlyCompletedCollections.push(collection);
      }
    }
    const newlyUnlockedPuzzles = PUZZLES.filter((puzzle) => (nextProgress.unlockedPuzzleIds ?? []).includes(puzzle.id)
      && !previouslyUnlockedPuzzleIds.has(puzzle.id));
    const notebookDiscoveries = [...(game.notebook?.discoveries ?? [])];
    for (const collection of newlyCompletedCollections) {
      if (collection.discoveryId && !notebookDiscoveries.includes(collection.discoveryId)) {
        notebookDiscoveries.push(collection.discoveryId);
      }
    }

    updateGame((current) => ({
      ...current,
      items,
      progress: nextProgress,
      notebook: { ...(current.notebook ?? {}), discoveries: notebookDiscoveries },
    }));

    for (const item of movedItems) {
      if (item.validation === 'correct') {
        emitGameAudioEvent('item.placement.correct', {
          itemId: item.id,
          targetKind: target.kind,
          ...(target.id ? { targetId: target.id } : {}),
        });
      } else if (item.validation === 'invalid') {
        emitGameAudioEvent('item.placement.invalid', {
          itemId: item.id,
          targetKind: target.kind,
          ...(target.id ? { targetId: target.id } : {}),
        });
      }
    }
    for (const collection of newlyCompletedCollections) {
      emitGameAudioEvent('collection.completed', { collectionId: collection.id });
    }
    for (const puzzle of newlyUnlockedPuzzles) {
      emitGameAudioEvent('puzzle.discovered', { puzzleId: puzzle.id });
    }

    setSelectedItemIds([]);
    setMultiSelectionMode(false);
    setSelectedItemId(null);
    setKeyboardFocusItemId(null);
    const newlyUnlockedPuzzle = newlyUnlockedPuzzles[0] ?? null;
    setActiveRightPanel(newlyUnlockedPuzzle ? 'puzzle' : null);
    if (!newlyUnlockedPuzzle) {
      window.requestAnimationFrame(() => worldRef.current?.focusSelectionToggle());
    }

    const correctCount = movedItems.filter((item) => item.validation === 'correct').length;
    const invalidCount = movedItems.filter((item) => item.validation === 'invalid').length;
    if (target.kind === 'scratchpad') {
      setToast(`${movedItems.length} objects placed on the work surface. This is a temporary arrangement.`);
    } else if (target.kind === 'workspace') {
      setToast(`${movedItems.length} objects returned to the laboratory workspace.`);
    } else {
      setToast(`${movedItems.length} objects moved. ${correctCount} filed correctly${invalidCount ? `; ${invalidCount} visibly misfiled` : ''}.`);
    }

    if (newlyCompletedCollections.length > 0) {
      const lastCompleted = newlyCompletedCollections.at(-1);
      const isChapterCollection = CHAPTER_COLLECTION_IDS.includes(lastCompleted.id);
      if (newlyUnlockedPuzzle) {
        setActivePuzzleId(newlyUnlockedPuzzle.id);
        setToast(`${lastCompleted.label} restored. ${newlyUnlockedPuzzle.title} is now available.`);
      } else if (isChapterCollection) {
        const restoredChapterCollections = (nextProgress.completedCollectionIds ?? []).filter((id) => CHAPTER_COLLECTION_IDS.includes(id)).length;
        setToast(`${lastCompleted.label} restored. ${restoredChapterCollections} of ${CHAPTER_COLLECTION_IDS.length} research collections restored.`);
      } else {
        setToast(`${lastCompleted.label} restored. One insight point earned.`);
      }
      setActiveLeftPanel('notebook');
    }

    if (target.kind === 'destination') {
      const destination = DESTINATIONS.find((entry) => entry.id === target.id);
      if (destination) worldRef.current?.focusDestination(destination, target.id === 'cabinet-calibration' ? 0.5 : undefined);
    } else if (target.kind === 'scratchpad') {
      const pad = scratchPads.find((entry) => entry.id === target.id);
      if (pad) worldRef.current?.focusScratchPad(pad);
    } else if (target.kind === 'workspace') {
      worldRef.current?.focusItem(movedItems.at(-1));
    }
    return true;
  };

  const handleToggleMultiSelectionMode = () => {
    const nextMode = !multiSelectionMode;
    if (nextMode && selectedItemId && !selectedItemIds.includes(selectedItemId)) {
      setSelectedItemIds([...selectedItemIds, selectedItemId]);
    }
    setMultiSelectionMode(nextMode);
    setKeyboardFocusItemId(null);
    setToast(nextMode
      ? 'Select or deselect objects in the laboratory, then move them together from the Inspector.'
      : selectedItemIds.length > 0 ? `${selectedItemIds.length} objects remain selected.` : 'Multiple selection closed.');
  };

  const handleToggleItemSelection = (itemId) => {
    const isSelected = selectedItemIds.includes(itemId);
    if (!isSelected && selectedItemIds.length >= MAX_BATCH_SELECTION) {
      setToast(`The selection limit is ${MAX_BATCH_SELECTION} objects. Deselect an object before selecting another.`);
      return;
    }
    const nextIds = isSelected
      ? selectedItemIds.filter((id) => id !== itemId)
      : [...selectedItemIds, itemId];
    setSelectedItemIds(nextIds);
    setSelectedItemId(isSelected ? (nextIds.at(-1) ?? null) : itemId);
    setActiveRightPanel(nextIds.length > 0 ? 'inspector' : null);
    setKeyboardFocusItemId(null);
    setActiveLeftPanel((current) => current === 'skills' ? null : current);
    setToast(`${nextIds.length} ${nextIds.length === 1 ? 'object' : 'objects'} selected.`);
  };

  const handleSelectItem = (itemId, activation = {}) => {
    setSelectedItemIds([]);
    setMultiSelectionMode(false);
    setSelectedItemId(itemId);
    setActiveRightPanel('inspector');
    setKeyboardFocusItemId(activation.keyboard ? itemId : null);
    setActiveLeftPanel((current) => current === 'skills' ? null : current);
  };

  const handleOpenFinder = () => {
    setActiveLeftPanel((current) => current === 'skills' ? null : current);
    setActiveRightPanel(null);
  };

  const handlePurchaseSkill = (skillId) => {
    const skill = SKILLS.find((entry) => entry.id === skillId);
    if (!skill || progress.skillPoints < skill.cost || (progress.ownedSkills ?? []).includes(skillId)) return;
    updateGame((current) => ({
      ...current,
      progress: {
        ...current.progress,
        skillPoints: current.progress.skillPoints - skill.cost,
        ownedSkills: [...(current.progress.ownedSkills ?? []), skillId],
      },
    }));
    emitGameAudioEvent('skill.unlocked', { skillId });
    setToast(skill.purchaseConfirmation ?? `${skill.label} assembled. Choose a specimen to focus it.`);
    setActiveLeftPanel('skills');
  };

  const handleToggleSkill = (skillId) => {
    if (skillId === RESONANCE_LENS_ID) {
      if (!selectedItem) {
        setLensMessage('Select an object first to give the Resonance Lens a point of focus.');
        return;
      }
      const active = !lensActive;
      setLensActive(active);
      setLensMessage(active ? `Related items to ${selectedItem.title} are glimmering.` : 'The lens is idle.');
      if (active) emitGameAudioEvent('skill.activated', { skillId });
      return;
    }

    if (skillId === MISSING_MEMBER_COMPASS_ID) {
      if (!selectedItem?.collectionId || !CHAPTER_COLLECTION_IDS.includes(selectedItem.collectionId)) {
        setLensMessage('Select a chapter record before activating the Missing Member Compass.');
        return;
      }
      if (missingMemberId) {
        setMissingMemberId(null);
        setLensMessage('The Missing Member Compass is idle.');
        return;
      }
      const targetId = compassCandidateId;
      if (!targetId) {
        setLensMessage('No loose chapter member remains in this collection.');
        return;
      }
      setMissingMemberId(targetId);
      const target = game.items.find((item) => item.id === targetId);
      emitGameAudioEvent('skill.activated', { skillId });
      if (target) worldRef.current?.focusItem(target);
      setLensMessage(target ? `The compass points toward ${target.title}.` : 'The compass has found a missing chapter member.');
      return;
    }

    if (skillId === AETHER_WAYFINDER_ID) {
      if (!selectedItem) {
        setLensMessage('Select a loose or misfiled object before using the Aether Wayfinder.');
        return;
      }
      if (isCorrectlyFiled(selectedItem)) {
        setGuidedDestination(null);
        setLensMessage('That object is already correctly filed.');
        return;
      }
      const destination = DESTINATIONS.find((entry) => entry.id === selectedItem.correctDestinationId);
      if (!destination) {
        setLensMessage('The Wayfinder cannot identify this object’s intended destination.');
        return;
      }
      if (wayfinderActive) {
        setGuidedDestination(null);
        setLensMessage('The Aether Wayfinder is idle.');
        return;
      }
      setGuidedDestination({ itemId: selectedItem.id, itemTitle: selectedItem.title, destinationId: destination.id });
      worldRef.current?.focusDestination(destination, 0.72, { fitToViewport: true });
      emitGameAudioEvent('skill.activated', { skillId });
      setLensMessage('');
    }
  };

  const handleSolvePuzzle = (puzzleId) => {
    if ((progress.solvedPuzzleIds ?? []).includes(puzzleId)) return;
    const puzzle = PUZZLES.find((entry) => entry.id === puzzleId);
    if (!puzzle) return;
    const requirements = puzzle.requiresCompletedCollectionIds ?? [];
    const prerequisitesMet = requirements.every((collectionId) => {
      const collection = COLLECTIONS.find((entry) => entry.id === collectionId);
      return collection
        && collectionIsComplete(collection, game.items)
        && (progress.completedCollectionIds ?? []).includes(collectionId);
    });
    if (!prerequisitesMet || !(progress.unlockedPuzzleIds ?? []).includes(puzzleId)) return;
    const rewardStage = puzzle.reward?.inventionStage;
    updateGame((current) => {
      const discoveries = [...(current.notebook?.discoveries ?? [])];
      const clueId = puzzle.reward?.clueId;
      if (clueId && !discoveries.includes(clueId)) discoveries.push(clueId);
      return {
        ...current,
        progress: { ...current.progress, solvedPuzzleIds: [...(current.progress.solvedPuzzleIds ?? []), puzzleId] },
        inventionStage: nextInventionStage(current.inventionStage, rewardStage),
        notebook: { ...(current.notebook ?? {}), discoveries },
      };
    });
    const nextStage = nextInventionStage(game.inventionStage, rewardStage);
    emitGameAudioEvent('puzzle.completed', { puzzleId });
    if (nextStage !== game.inventionStage) {
      emitGameAudioEvent('machinery.stage.changed', {
        fromStage: game.inventionStage,
        toStage: nextStage,
      });
      if (game.inventionStage !== 'Chronology Wheel' && nextStage === 'Chronology Wheel') {
        emitGameAudioEvent('invention.assembled', { inventionId: 'palimpsest-engine' });
      }
    }
    setToast(puzzle.id === 'pulse-sequence'
      ? 'The pulse sequence resolves. A Memory Crystal has formed in the Palimpsest Engine.'
      : 'The dates align. A Chronology Wheel joins the Palimpsest Engine.');
  };

  const handleImportSave = (compressed) => {
    const result = importSave(compressed, game);
    if (!result.ok) return result;
    const importedState = result.state;
    try {
      window.localStorage.setItem(BACKUP_SAVE_KEY, encodeSave(game));
    } catch {
      return { ok: false, state: game, error: 'The current laboratory could not be backed up, so the import was not applied.' };
    }
    const importedGameComplete = isGameComplete({
      items: importedState.items,
      progress: importedState.progress,
      collections: COLLECTIONS,
      puzzles: PUZZLES,
      expectedItemIds: DEFAULT_GAME_ITEM_IDS,
    });
    suppressCompletionAudioRef.current = !gameComplete && importedGameComplete;
    updateGame(importedState);
    try { setSaveText(encodeSave(importedState)); } catch { setSaveText(''); }
    setSelectedItemId(null);
    setSelectedItemIds([]);
    setMultiSelectionMode(false);
    setLensActive(false);
    setMissingMemberId(null);
    setActivePuzzleId(null);
    setActiveRightPanel(null);
    setAutosaveEnabled(true);
    setCanStartFresh(false);
    setRecoveryNotice(null);
    setToast(result.notice ? `${result.notice} Laboratory restored.` : 'Laboratory restored from the imported save.');
    return { ok: true, state: importedState };
  };

  const openSaveDialog = () => {
    try { setSaveText(encodeSave(game)); } catch { setSaveText(''); }
    setSaveOpen(true);
  };

  const handlePreferenceChange = (nextValues, gestureEvent) => {
    const nextPreferences = normalizePreferences({ ...preferences, ...nextValues });
    setPreferences(nextPreferences);
    if (Object.prototype.hasOwnProperty.call(nextValues, 'soundEffectsEnabled')) {
      try {
        audioAdapterRef.current?.setEnabled(nextPreferences.soundEffectsEnabled);
      } catch {
        // Audio support is optional and must not block applying a preference.
      }
      if (nextPreferences.soundEffectsEnabled) unlockAudioFromGesture(gestureEvent);
    }
    setPreferencesStatus(savePreferences(nextPreferences)
      ? 'Settings saved.'
      : 'Changes apply for this session, but could not be saved.');
  };

  const unlockAudioFromGesture = (event) => {
    if (event?.nativeEvent?.isTrusted !== true && event?.isTrusted !== true) return;
    try {
      const unlockResult = audioAdapterRef.current?.unlock();
      if (unlockResult && typeof unlockResult.then === 'function') {
        void Promise.resolve(unlockResult).catch(() => {});
      }
    } catch {
      // A rejected or unavailable AudioContext must not interrupt the gesture.
    }
  };

  const handleStartFresh = () => {
    if (!canStartFresh) return;
    setAutosaveEnabled(true);
    setCanStartFresh(false);
    setRecoveryNotice(null);
    setToast('Autosave is enabled for this fresh laboratory. The damaged save remains in recovery storage.');
  };

  const focusCollection = (collection) => {
    const destination = DESTINATIONS.find((entry) => entry.id === collection.destinationId);
    setActiveLeftPanel(null);
    if (destination) worldRef.current?.focusDestination(destination);
  };

  const openPuzzle = () => {
    if (activePuzzle) setActivePuzzleId(activePuzzle.id);
    setActiveRightPanel('puzzle');
    setActiveLeftPanel(null);
  };

  return (
    <div
      className="game-shell"
      data-testid="game-shell"
      onPointerDownCapture={unlockAudioFromGesture}
      onKeyDownCapture={unlockAudioFromGesture}
    >
      <header className="game-header">
        <div className="game-brand">
          <p className="brand-kicker">A laboratory of lost things</p>
          <h1>The Palimpsest Engine</h1>
        </div>
        <div className="header-progress" aria-label={`Laboratory ${restoredPercent}% restored`}>
          <span className="progress-dial" aria-hidden="true">{restoredPercent}<small>%</small></span>
          <span><strong>Restoration</strong><small data-testid="skill-points">{(progress.completedCollectionIds ?? []).length} collections · Skill points: {progress.skillPoints}</small><small data-testid="chapter-progress">Research collections: {chapterCompletedCount} of {CHAPTER_COLLECTIONS.length}</small><small data-testid="invention-stage">Invention stage: {game.inventionStage}</small></span>
        </div>
        <nav className="header-actions" aria-label="Laboratory tools">
          <button type="button" className="header-control" data-testid="toggle-notebook" aria-pressed={activeLeftPanel === 'notebook'} onClick={() => setActiveLeftPanel(activeLeftPanel === 'notebook' ? null : 'notebook')}>Notebook</button>
          <button type="button" className="header-control" data-testid="toggle-skills" aria-pressed={activeLeftPanel === 'skills'} onClick={() => {
            const openingSkills = activeLeftPanel !== 'skills';
            setActiveLeftPanel(openingSkills ? 'skills' : null);
            if (openingSkills && (activeRightPanel === 'puzzle' || activeRightPanel === 'inspector')) setActiveRightPanel(null);
          }}>Instruments</button>
          {activePuzzle && <button type="button" className="header-control puzzle-nav" data-testid="open-puzzle" onClick={openPuzzle}>{puzzleSolved ? `${activePuzzle.title} · solved` : activePuzzle.title}</button>}
          <button type="button" className="header-control" data-testid="open-saves" onClick={openSaveDialog}>Save &amp; restore</button>
          <button type="button" className="header-control" data-testid="open-settings" onClick={() => { setPreferencesStatus(''); setSettingsOpen(true); }}>Settings</button>
        </nav>
      </header>

      <main className="game-main">
        {recoveryNotice && (
          <aside className="save-recovery-notice" role="alert" data-testid="recovery-notice">
            <p>{recoveryNotice}</p>
            <div className="recovery-actions">
              {!autosaveEnabled && canStartFresh && (
                <button type="button" className="primary-control" data-testid="start-fresh-lab" onClick={handleStartFresh}>
                  Start fresh laboratory
                </button>
              )}
              <button type="button" className="text-control" data-testid="recovery-open-saves" onClick={openSaveDialog}>
                Open Save &amp; Restore
              </button>
              {autosaveEnabled && <button type="button" className="panel-close" aria-label="Dismiss save recovery notice" onClick={() => setRecoveryNotice(null)}>×</button>}
            </div>
          </aside>
        )}
        {activeLeftPanel === 'notebook' && <NotebookPanel collections={COLLECTIONS} items={game.items} progress={progress} discoveries={game.notebook?.discoveries ?? []} discoveryEntries={NOTEBOOK_DISCOVERIES} onFocusCollection={focusCollection} />}
        {activeLeftPanel === 'skills' && <SkillsPanel progress={progress} activeSkillIds={activeSkillIds} canUseSkills={canUseSkills} onPurchaseSkill={handlePurchaseSkill} onToggleSkill={handleToggleSkill} />}
        <WorldViewport
          ref={worldRef}
          items={game.items}
          destinations={DESTINATIONS}
          scratchPads={scratchPads}
          collections={COLLECTIONS}
          camera={game.camera}
          onCameraChange={handleCameraChange}
          onDrop={handleDrop}
          onSelectItem={handleSelectItem}
          onToggleItemSelection={handleToggleItemSelection}
          onToggleSelectionMode={handleToggleMultiSelectionMode}
          onOpenFinder={handleOpenFinder}
          selectedItemId={selectedItemId}
          selectedItemIds={selectedItemIds}
          multiSelectionMode={multiSelectionMode}
          keyboardFocusItemId={keyboardFocusItemId}
          lensActive={lensActive}
          highlightedItemIds={missingMemberId ? [missingMemberId] : []}
          guidedDestinationId={guidedDestination?.destinationId}
          guidedItemTitle={guidedDestination?.itemTitle}
          inventionStage={game.inventionStage}
          progress={progress}
          worldBounds={WORLD_BOUNDS}
        />
        {activeRightPanel === 'inspector' && (
          <ItemInspector
            item={selectedItem}
            selectedItems={selectedItemIds.map((itemId) => game.items.find((item) => item.id === itemId)).filter(Boolean)}
            destinations={DESTINATIONS}
            scratchPads={scratchPads}
            focusMoveItemId={keyboardFocusItemId}
            onClose={() => setActiveRightPanel(null)}
            onFocus={(item) => worldRef.current?.focusItem(item)}
            onMove={(itemOrItems, target) => Array.isArray(itemOrItems)
              ? handleBatchInspectorMove(itemOrItems, target)
              : handleInspectorMove(itemOrItems, target)}
          />
        )}
        {activeRightPanel === 'puzzle' && activePuzzle && (
          <PuzzlePanel puzzle={activePuzzle} solved={puzzleSolved} unlockedPuzzles={unlockedPuzzles} onSelectPuzzle={setActivePuzzleId} onSolve={handleSolvePuzzle} onClose={() => setActiveRightPanel(null)} />
        )}
        <div className="lab-toast" aria-live="polite" role="status" data-testid="game-feedback">{toast}</div>
        <div className="sr-only" aria-live="polite" data-testid="skill-announcer">{lensMessage}</div>
        <div className="game-save-indicator" aria-live="polite" data-testid="autosave-status">{saveStatus}</div>
      </main>

      {saveOpen && (
        <SaveDialog
          encodedSave={saveText}
          saveStatus={saveStatus}
          onClose={() => setSaveOpen(false)}
          onImport={handleImportSave}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          preferences={preferences}
          saveStatus={preferencesStatus}
          onChange={handlePreferenceChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {completionOpen && (
        <CompletionSequence stats={completionStats} userReducedMotion={preferences.reduceMotion} onContinue={() => setCompletionOpen(false)} />
      )}
    </div>
  );
}
