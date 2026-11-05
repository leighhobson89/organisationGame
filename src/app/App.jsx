import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CHAPTER_COLLECTION_IDS, COLLECTIONS, DESTINATIONS, getScratchPadsForOwnedSkills, NOTEBOOK_DISCOVERIES, PUZZLES, SKILLS, WORLD_BOUNDS } from '../game/content/catalog.js';
import { emitGameAudioEvent } from '../game/audio/audioEvents.js';
import { createWebAudioAdapter } from '../game/audio/webAudioAdapter.js';
import { getCompletionStats, isCollectionComplete, isCorrectlyFiled, isGameComplete } from '../game/domain/completion.js';
import { findMissingCollectionMember } from '../game/domain/progression.js';
import { planPuzzleCompletion } from '../game/domain/puzzleCompletion.js';
import { getResonanceLensMatches } from '../game/domain/skillHighlights.js';
import { planBatchPlacement, planSinglePlacement } from '../game/domain/placementTransaction.js';
import { DEFAULT_GAME_ITEM_IDS } from '../game/persistence/gameState.js';
import { loadPreferences, normalizePreferences, savePreferences } from '../game/preferences/preferences.js';
import { CompletionSequence } from '../ui/CompletionSequence.jsx';
import { EMPTY_HIGHLIGHTED_ITEM_IDS } from '../ui/highlightedItemIds.js';
import { ItemInspector } from '../ui/ItemInspector.jsx';
import { HowToPlayDialog } from '../ui/HowToPlayDialog.jsx';
import { NotebookPanel } from '../ui/NotebookPanel.jsx';
import { PuzzlePanel } from '../ui/PuzzlePanel.jsx';
import { SaveDialog } from '../ui/SaveDialog.jsx';
import { SettingsDialog } from '../ui/SettingsDialog.jsx';
import { SkillsPanel } from '../ui/SkillsPanel.jsx';
import { WorldViewport } from '../ui/WorldViewport.jsx';
import { useGamePersistence } from './useGamePersistence.js';

const RESONANCE_LENS_ID = 'resonance-lens';
const RESONANCE_LENS = SKILLS.find((skill) => skill.id === RESONANCE_LENS_ID) ?? { cost: 1, durationMs: 7000 };
const MISSING_MEMBER_COMPASS_ID = 'missing-member-compass';
const AETHER_WAYFINDER_ID = 'aether-wayfinder';
const AETHER_WAYFINDER = SKILLS.find((skill) => skill.id === AETHER_WAYFINDER_ID) ?? { cost: 2, durationMs: 7000 };
const CHAPTER_COLLECTIONS = COLLECTIONS.filter((collection) => CHAPTER_COLLECTION_IDS.includes(collection.id));
const MAX_BATCH_SELECTION = 40;
const COMPACT_PANEL_QUERY = '(max-width: 720px)';
const SHORT_TABLET_VIEW_QUERY = '(min-width: 721px) and (max-width: 1050px) and (min-height: 550px) and (max-height: 719px)';
const MEDIUM_SHORT_DESKTOP_VIEW_QUERY = '(min-width: 1051px) and (max-width: 1340px) and (min-height: 550px) and (max-height: 719px)';
const WIDE_SHORT_DESKTOP_VIEW_QUERY = '(min-width: 1341px) and (min-height: 550px) and (max-height: 719px)';
const SHORT_HEIGHT_LARGE_TEXT_SCALES = new Set([1.5, 1.75, 2]);

function isCompactViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(COMPACT_PANEL_QUERY).matches;
}

function isShortTabletViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(SHORT_TABLET_VIEW_QUERY).matches;
}

function isMediumShortDesktopViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(MEDIUM_SHORT_DESKTOP_VIEW_QUERY).matches;
}

function isWideShortDesktopViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(WIDE_SHORT_DESKTOP_VIEW_QUERY).matches;
}

function objectProgressPercent(items) {
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.validation === 'correct').length / items.length) * 100);
}

export default function App() {
  const {
    game,
    updateGame,
    autosaveEnabled,
    canStartFresh,
    recoveryNotice,
    saveStatus,
    saveText,
    openSaveDialog: prepareSaveText,
    importGame,
    startNewGame,
    startFresh,
    dismissRecoveryNotice,
  } = useGamePersistence();
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [multiSelectionMode, setMultiSelectionMode] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [preferences, setPreferences] = useState(() => loadPreferences());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [preferencesStatus, setPreferencesStatus] = useState('');
  const [keyboardFocusItemId, setKeyboardFocusItemId] = useState(null);
  const [activeLeftPanel, setActiveLeftPanel] = useState(null);
  const [activeRightPanel, setActiveRightPanel] = useState(null);
  const [isCompact, setIsCompact] = useState(isCompactViewport);
  const [isShortTablet, setIsShortTablet] = useState(isShortTabletViewport);
  const [isMediumShortDesktop, setIsMediumShortDesktop] = useState(isMediumShortDesktopViewport);
  const [isWideShortDesktop, setIsWideShortDesktop] = useState(isWideShortDesktopViewport);
  const [saveOpen, setSaveOpen] = useState(false);
  const [laboratoryGeneration, setLaboratoryGeneration] = useState(0);
  const [toast, setToast] = useState('');
  const [lensActive, setLensActive] = useState(false);
  const [lensMessage, setLensMessage] = useState('');
  const [missingMemberId, setMissingMemberId] = useState(null);
  const highlightedItemIds = useMemo(
    () => missingMemberId ? [missingMemberId] : EMPTY_HIGHLIGHTED_ITEM_IDS,
    [missingMemberId],
  );
  const [guidedDestination, setGuidedDestination] = useState(null);
  const [activePuzzleId, setActivePuzzleId] = useState(null);
  const suppressCompletionAudioRef = useRef(false);
  const previousCompletionRef = useRef(isGameComplete({
    items: game.items,
    progress: game.progress,
    collections: COLLECTIONS,
    puzzles: PUZZLES,
    expectedItemIds: DEFAULT_GAME_ITEM_IDS,
  }));
  const worldRef = useRef(null);
  const [worldOverlayHost, setWorldOverlayHost] = useState(null);
  const notebookToggleRef = useRef(null);
  const openPuzzleButtonRef = useRef(null);
  const documentPreferencesRef = useRef(null);
  const audioAdapterRef = useRef(null);
  const isLargeTextShortHeight = SHORT_HEIGHT_LARGE_TEXT_SCALES.has(preferences.textScale);
  const shortTabletLargeTextGuidance = isShortTablet && isLargeTextShortHeight;
  const mediumShortDesktopLargeTextGuidance = isMediumShortDesktop && isLargeTextShortHeight;
  const wideShortDesktopLargeTextGuidance = isWideShortDesktop && isLargeTextShortHeight;
  const shortHeightLargeTextGuidance = shortTabletLargeTextGuidance
    || mediumShortDesktopLargeTextGuidance
    || wideShortDesktopLargeTextGuidance;
  const selectedItem = game.items.find((item) => item.id === selectedItemId) ?? null;
  const progress = game.progress;
  const scratchPads = useMemo(() => getScratchPadsForOwnedSkills(progress.ownedSkills), [progress.ownedSkills]);
  const unlockedPuzzleIds = progress.unlockedPuzzleIds ?? [];
  const unlockedPuzzles = PUZZLES.filter((puzzle) => unlockedPuzzleIds.includes(puzzle.id)
    && (puzzle.requiresCompletedCollectionIds ?? []).every((collectionId) => (
      (progress.completedCollectionIds ?? []).includes(collectionId)
    )));
  const solvedPuzzleIds = progress.solvedPuzzleIds ?? [];
  const activePuzzle = unlockedPuzzles.find((puzzle) => puzzle.id === activePuzzleId)
    ?? unlockedPuzzles.find((puzzle) => !solvedPuzzleIds.includes(puzzle.id))
    ?? unlockedPuzzles.at(-1)
    ?? null;
  const puzzleSolved = Boolean(activePuzzle && solvedPuzzleIds.includes(activePuzzle.id));
  const chapterCompletedCount = CHAPTER_COLLECTIONS.filter((collection) => isCollectionComplete(collection, game.items)).length;
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
  const handleCompletionFocusReturn = useCallback(() => {
    worldRef.current?.focusSelectionToggle();
  }, []);

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
    const compactMediaQuery = window.matchMedia(COMPACT_PANEL_QUERY);
    const shortTabletMediaQuery = window.matchMedia(SHORT_TABLET_VIEW_QUERY);
    const mediumShortDesktopMediaQuery = window.matchMedia(MEDIUM_SHORT_DESKTOP_VIEW_QUERY);
    const wideShortDesktopMediaQuery = window.matchMedia(WIDE_SHORT_DESKTOP_VIEW_QUERY);
    const updateCompactMode = (event) => setIsCompact(event.matches);
    const updateShortTabletMode = (event) => setIsShortTablet(event.matches);
    const updateMediumShortDesktopMode = (event) => setIsMediumShortDesktop(event.matches);
    const updateWideShortDesktopMode = (event) => setIsWideShortDesktop(event.matches);
    setIsCompact(compactMediaQuery.matches);
    setIsShortTablet(shortTabletMediaQuery.matches);
    setIsMediumShortDesktop(mediumShortDesktopMediaQuery.matches);
    setIsWideShortDesktop(wideShortDesktopMediaQuery.matches);
    if (compactMediaQuery.addEventListener) compactMediaQuery.addEventListener('change', updateCompactMode);
    else compactMediaQuery.addListener(updateCompactMode);
    if (shortTabletMediaQuery.addEventListener) shortTabletMediaQuery.addEventListener('change', updateShortTabletMode);
    else shortTabletMediaQuery.addListener(updateShortTabletMode);
    if (mediumShortDesktopMediaQuery.addEventListener) mediumShortDesktopMediaQuery.addEventListener('change', updateMediumShortDesktopMode);
    else mediumShortDesktopMediaQuery.addListener(updateMediumShortDesktopMode);
    if (wideShortDesktopMediaQuery.addEventListener) wideShortDesktopMediaQuery.addEventListener('change', updateWideShortDesktopMode);
    else wideShortDesktopMediaQuery.addListener(updateWideShortDesktopMode);
    return () => {
      if (compactMediaQuery.removeEventListener) compactMediaQuery.removeEventListener('change', updateCompactMode);
      else compactMediaQuery.removeListener(updateCompactMode);
      if (shortTabletMediaQuery.removeEventListener) shortTabletMediaQuery.removeEventListener('change', updateShortTabletMode);
      else shortTabletMediaQuery.removeListener(updateShortTabletMode);
      if (mediumShortDesktopMediaQuery.removeEventListener) mediumShortDesktopMediaQuery.removeEventListener('change', updateMediumShortDesktopMode);
      else mediumShortDesktopMediaQuery.removeListener(updateMediumShortDesktopMode);
      if (wideShortDesktopMediaQuery.removeEventListener) wideShortDesktopMediaQuery.removeEventListener('change', updateWideShortDesktopMode);
      else wideShortDesktopMediaQuery.removeListener(updateWideShortDesktopMode);
    };
  }, []);

  useLayoutEffect(() => {
    if (isCompact && activeLeftPanel && activeRightPanel) setActiveLeftPanel(null);
  }, [activeLeftPanel, activeRightPanel, isCompact]);

  useLayoutEffect(() => {
    if (isCompact && (activeLeftPanel || activeRightPanel)) {
      worldRef.current?.closeAtlas({ restoreFocus: false, restoreFocusIfAtlasFocused: true });
      worldRef.current?.closeFinder({ restoreFocus: false, restoreFocusIfFinderFocused: true });
    }
  }, [activeLeftPanel, activeRightPanel, isCompact]);

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

  const handleDrop = (itemId, target, position, { focusSelectionToggleAfterCompletion = false } = {}) => {
    if (!game.items.some((entry) => entry.id === itemId)) return null;
    const result = planSinglePlacement({ game, itemId, target, position });
    if (!result.ok) {
      setToast(result.reason);
      return null;
    }

    const { items, progress, discoveries } = result.changes;
    const movedItem = result.movedItems[0];
    const newlyCompletedCollections = result.newlyCompletedCollections;
    const newlyCompleted = newlyCompletedCollections.at(-1) ?? null;
    const newlyUnlockedPuzzle = result.newlyUnlockedPuzzles[0] ?? null;
    updateGame((current) => ({
      ...current,
      items,
      progress,
      notebook: { ...(current.notebook ?? {}), discoveries },
    }));
    if (movedItem.validation === 'correct') {
      emitGameAudioEvent('item.placement.correct', {
        itemId,
        targetKind: target.kind,
        ...(target.id ? { targetId: target.id } : {}),
      });
    } else if (movedItem.validation === 'invalid') {
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
    if (isCompact && !newlyCompleted) setActiveLeftPanel(null);

    if (movedItem.validation === 'correct') {
      setToast('Filed correctly. The brass index clicks into place.');
    } else if (movedItem.validation === 'invalid') {
      setToast('Misfiled. The object remains where you left it; move it again when you are ready.');
    } else if (target.kind === 'scratchpad') {
      setToast('Placed on the work surface. This is a temporary arrangement, not a final filing.');
    }

    if (newlyCompleted) {
      const isChapterCollection = CHAPTER_COLLECTION_IDS.includes(newlyCompleted.id);
      if (newlyUnlockedPuzzle) {
        setActivePuzzleId(newlyUnlockedPuzzle.id);
        setActiveRightPanel('puzzle');
        setActiveLeftPanel(isCompact ? null : 'notebook');
        setToast(`${newlyCompleted.label} restored. ${newlyUnlockedPuzzle.title} is now available.`);
      } else {
        setActiveRightPanel(isCompact ? null : 'inspector');
        setActiveLeftPanel('notebook');
        if (isChapterCollection) {
          const restoredChapterCollections = CHAPTER_COLLECTIONS.filter((collection) => isCollectionComplete(collection, items)).length;
          setToast(`${newlyCompleted.label} restored. ${restoredChapterCollections} of ${CHAPTER_COLLECTION_IDS.length} research collections restored.`);
        } else {
          setToast(`${newlyCompleted.label} restored. One insight point earned.`);
        }
      }
    }
    if (focusSelectionToggleAfterCompletion && isCompact && newlyCompleted && !newlyUnlockedPuzzle) {
      window.requestAnimationFrame(() => worldRef.current?.focusSelectionToggle());
    }
    return movedItem;
  };

  const handleInspectorMove = (item, target) => {
    const movedItem = handleDrop(item.id, target, undefined, { focusSelectionToggleAfterCompletion: true });
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
    const result = planBatchPlacement({ game, itemIds, target });
    if (!result.ok) {
      setToast(result.reason);
      return false;
    }

    const { items, progress, discoveries } = result.changes;
    const { movedItems, validationCounts, newlyCompletedCollections, newlyUnlockedPuzzles } = result;
    const newlyUnlockedPuzzle = newlyUnlockedPuzzles[0] ?? null;

    updateGame((current) => ({
      ...current,
      items,
      progress,
      notebook: { ...(current.notebook ?? {}), discoveries },
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
    setActiveRightPanel(newlyUnlockedPuzzle ? 'puzzle' : null);
    if (!newlyUnlockedPuzzle) {
      window.requestAnimationFrame(() => worldRef.current?.focusSelectionToggle());
    }

    const { correct: correctCount, invalid: invalidCount } = validationCounts;
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
        setActiveLeftPanel(isCompact ? null : 'notebook');
        setToast(`${lastCompleted.label} restored. ${newlyUnlockedPuzzle.title} is now available.`);
      } else if (isChapterCollection) {
        const restoredChapterCollections = CHAPTER_COLLECTIONS.filter((collection) => isCollectionComplete(collection, items)).length;
        setToast(`${lastCompleted.label} restored. ${restoredChapterCollections} of ${CHAPTER_COLLECTION_IDS.length} research collections restored.`);
      } else {
        setToast(`${lastCompleted.label} restored. One insight point earned.`);
      }
      if (!newlyUnlockedPuzzle) setActiveLeftPanel('notebook');
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

  const handleToggleItemSelection = useCallback((itemId) => {
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
    setActiveLeftPanel((current) => (isCompact || current === 'skills') ? null : current);
    setToast(`${nextIds.length} ${nextIds.length === 1 ? 'object' : 'objects'} selected.`);
  }, [isCompact, selectedItemIds]);

  const handleSelectItem = useCallback((itemId, activation = {}) => {
    setSelectedItemIds([]);
    setMultiSelectionMode(false);
    setSelectedItemId(itemId);
    setActiveRightPanel('inspector');
    setKeyboardFocusItemId(activation.keyboard ? itemId : null);
    setActiveLeftPanel((current) => (isCompact || current === 'skills') ? null : current);
  }, [isCompact]);

  const handleOpenFinder = () => {
    setToast('');
    setActiveLeftPanel((current) => (isCompact || current === 'skills') ? null : current);
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
    if (isCompact) setActiveRightPanel(null);
  };

  const handleToggleSkill = (skillId) => {
    if (skillId === RESONANCE_LENS_ID) {
      if (!selectedItem) {
        setLensMessage('Select an object first to give the Resonance Lens a point of focus.');
        return;
      }
      const active = !lensActive;
      setLensActive(active);
      if (active) {
        const matchCount = getResonanceLensMatches(game.items, selectedItem).length;
        const message = `The Resonance Lens reveals ${matchCount} items related to ${selectedItem.title}.`;
        setToast(message);
        emitGameAudioEvent('skill.activated', { skillId });
      } else {
        setLensMessage('The lens is idle.');
      }
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
    const completion = planPuzzleCompletion({ game, puzzleId });
    if (!completion.ok) return;
    updateGame((current) => {
      const latest = planPuzzleCompletion({ game: current, puzzleId });
      return latest.ok ? latest.nextGame : current;
    });
    emitGameAudioEvent('puzzle.completed', { puzzleId });
    if (completion.toStage !== completion.fromStage) {
      emitGameAudioEvent('machinery.stage.changed', {
        fromStage: completion.fromStage,
        toStage: completion.toStage,
      });
      if (completion.fromStage !== 'Chronology Wheel' && completion.toStage === 'Chronology Wheel') {
        emitGameAudioEvent('invention.assembled', { inventionId: 'palimpsest-engine' });
      }
    }
    setToast(puzzleId === 'pulse-sequence'
      ? 'The pulse sequence resolves. A Memory Crystal has formed in the Palimpsest Engine.'
      : 'The dates align. A Chronology Wheel joins the Palimpsest Engine.');
  };

  const handleImportSave = (compressed) => {
    const result = importGame(compressed, (importedState) => {
      const importedGameComplete = isGameComplete({
        items: importedState.items,
        progress: importedState.progress,
        collections: COLLECTIONS,
        puzzles: PUZZLES,
        expectedItemIds: DEFAULT_GAME_ITEM_IDS,
      });
      suppressCompletionAudioRef.current = !gameComplete && importedGameComplete;
    });
    if (!result.ok) return result;
    setSelectedItemId(null);
    setSelectedItemIds([]);
    setMultiSelectionMode(false);
    setLensActive(false);
    setMissingMemberId(null);
    setActivePuzzleId(null);
    setActiveRightPanel(null);
    setToast(result.notice ? `${result.notice} Laboratory restored.` : 'Laboratory restored from the imported save.');
    return { ok: true, state: result.state };
  };

  const openSaveDialog = () => {
    prepareSaveText();
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

  const handleAudioPreview = async (event) => {
    const gestureEvent = event?.nativeEvent ?? event;
    if (gestureEvent?.isTrusted !== true) return false;
    try {
      return Boolean(await audioAdapterRef.current?.preview());
    } catch {
      return false;
    }
  };

  const handleStartFresh = () => {
    if (!startFresh()) return;
    setToast('Autosave is enabled for this fresh laboratory. The damaged save remains in recovery storage.');
  };

  const handleStartNewGame = () => {
    const result = startNewGame(() => {
      suppressCompletionAudioRef.current = false;
      previousCompletionRef.current = false;
      setSelectedItemId(null);
      setSelectedItemIds([]);
      setMultiSelectionMode(false);
      setCompletionOpen(false);
      setHowToPlayOpen(false);
      setLensActive(false);
      setLensMessage('');
      setMissingMemberId(null);
      setGuidedDestination(null);
      setActivePuzzleId(null);
      setActiveLeftPanel(null);
      setActiveRightPanel(null);
      setKeyboardFocusItemId(null);
      setLaboratoryGeneration((generation) => generation + 1);
    });
    if (!result.ok) return result;
    setToast('New laboratory started. Your previous progress is backed up; manual save slots are unchanged.');
    return result;
  };

  const handleBeginFirstTask = () => {
    setHowToPlayOpen(false);
    const firstItem = game.items.find((item) => item.id === 'calibration-card-01');
    if (!firstItem) return;
    worldRef.current?.focusItem(firstItem);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => worldRef.current?.focusItemControl([firstItem.id]));
    });
    setToast('First task: inspect the Carrier Tone Plate, then file it in the Harmonic Calibration Folio.');
  };

  const focusCollection = (collection) => {
    const destination = DESTINATIONS.find((entry) => entry.id === collection.destinationId);
    setActiveLeftPanel(null);
    if (destination) worldRef.current?.focusDestination(destination, undefined, { announce: true });
    window.requestAnimationFrame(() => notebookToggleRef.current?.focus());
  };

  const openPuzzle = () => {
    if (activePuzzle) setActivePuzzleId(activePuzzle.id);
    setActiveRightPanel('puzzle');
    setActiveLeftPanel(null);
  };

  const closeInspector = () => {
    setActiveRightPanel(null);
    const focusCandidates = [selectedItemId, ...selectedItemIds].filter(Boolean);
    window.requestAnimationFrame(() => worldRef.current?.focusItemControl(focusCandidates));
  };

  const closePuzzle = () => {
    setActiveRightPanel(null);
    window.requestAnimationFrame(() => openPuzzleButtonRef.current?.focus());
  };

  return (
    <div
      className="game-shell"
      data-testid="game-shell"
      data-short-tablet-large-text={shortTabletLargeTextGuidance ? 'true' : undefined}
      data-medium-short-large-text={mediumShortDesktopLargeTextGuidance ? 'true' : undefined}
      data-wide-short-large-text={wideShortDesktopLargeTextGuidance ? 'true' : undefined}
      onPointerDownCapture={unlockAudioFromGesture}
      onKeyDownCapture={unlockAudioFromGesture}
    >
      <header className="game-header">
        <div className="game-brand">
          <p className="brand-kicker">A laboratory of lost things</p>
          <h1>The Palimpsest Engine</h1>
        </div>
        <div className="header-progress">
          <span className="progress-dial" role="progressbar" aria-label="Laboratory restoration" aria-valuemin={0} aria-valuemax={100} aria-valuenow={restoredPercent}>{restoredPercent}<small>%</small></span>
          <span className="header-progress__copy">
            <strong>Restoration</strong>
            {shortHeightLargeTextGuidance ? (
              <details className="header-progress__details">
                <summary>Progress details</summary>
                <span className="header-progress__metrics">
                  <small data-testid="skill-points">{(progress.completedCollectionIds ?? []).length} collection rewards · Skill points: {progress.skillPoints}</small>
                  <small data-testid="chapter-progress">Research collections: {chapterCompletedCount} of {CHAPTER_COLLECTIONS.length}</small>
                  <small data-testid="invention-stage">Invention stage: {game.inventionStage}</small>
                </span>
              </details>
            ) : (
              <span className="header-progress__metrics">
                <small data-testid="skill-points">{(progress.completedCollectionIds ?? []).length} collection rewards · Skill points: {progress.skillPoints}</small>
                <small data-testid="chapter-progress">Research collections: {chapterCompletedCount} of {CHAPTER_COLLECTIONS.length}</small>
                <small data-testid="invention-stage">Invention stage: {game.inventionStage}</small>
              </span>
            )}
          </span>
        </div>
        <nav className="header-actions" aria-label="Laboratory tools" onFocus={(event) => {
          const actions = event.currentTarget;
          const focusedControl = event.target;
          const actionsRect = actions.getBoundingClientRect();
          const focusedRect = focusedControl instanceof HTMLElement
            ? focusedControl.getBoundingClientRect()
            : null;
          const clippedByActions = focusedRect
            && (focusedRect.left < actionsRect.left - 1 || focusedRect.right > actionsRect.right + 1);
          const clippedByViewport = focusedRect
            && (focusedRect.left < -1 || focusedRect.right > window.innerWidth + 1);
          if (
            actions.scrollWidth > actions.clientWidth + 1
            && focusedControl instanceof HTMLElement
            && (clippedByActions || clippedByViewport)
          ) {
            focusedControl.scrollIntoView({ block: 'nearest', inline: 'center' });
          }
        }}>
          <button ref={notebookToggleRef} type="button" className="header-control" data-testid="toggle-notebook" aria-pressed={activeLeftPanel === 'notebook'} onClick={() => {
            const openingNotebook = activeLeftPanel !== 'notebook';
            setActiveLeftPanel(openingNotebook ? 'notebook' : null);
            if (openingNotebook && isCompact) setActiveRightPanel(null);
          }}>Notebook</button>
          <button type="button" className="header-control" data-testid="open-how-to-play" aria-label="How to Play" title="How to Play" onClick={() => setHowToPlayOpen(true)}>
            <span className="header-control__help-full">How to Play</span>
            <span className="header-control__help-compact" aria-hidden="true">Help</span>
          </button>
          <button type="button" className="header-control" data-testid="toggle-skills" aria-pressed={activeLeftPanel === 'skills'} onClick={() => {
            const openingSkills = activeLeftPanel !== 'skills';
            setActiveLeftPanel(openingSkills ? 'skills' : null);
            if (openingSkills && (isCompact || activeRightPanel === 'puzzle' || activeRightPanel === 'inspector')) setActiveRightPanel(null);
          }}>Instruments</button>
          {activePuzzle && <button ref={openPuzzleButtonRef} type="button" className="header-control puzzle-nav" data-testid="open-puzzle" onClick={openPuzzle}>{puzzleSolved ? `${activePuzzle.title} · solved` : activePuzzle.title}</button>}
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
              {autosaveEnabled && <button type="button" className="panel-close" aria-label="Dismiss save recovery notice" onClick={dismissRecoveryNotice}>×</button>}
            </div>
          </aside>
        )}
        {activeLeftPanel === 'notebook' && <NotebookPanel collections={COLLECTIONS} items={game.items} progress={progress} discoveries={game.notebook?.discoveries ?? []} discoveryEntries={NOTEBOOK_DISCOVERIES} onFocusCollection={focusCollection} />}
        {activeLeftPanel === 'skills' && <SkillsPanel progress={progress} activeSkillIds={activeSkillIds} canUseSkills={canUseSkills} onPurchaseSkill={handlePurchaseSkill} onToggleSkill={handleToggleSkill} />}
        <WorldViewport
          key={laboratoryGeneration}
          ref={worldRef}
          overlayRoot={worldOverlayHost}
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
          onOpenAtlas={() => {
            setToast('');
            if (isCompact) {
              setActiveLeftPanel(null);
              setActiveRightPanel(null);
            }
          }}
          selectedItemId={selectedItemId}
          selectedItemIds={selectedItemIds}
          multiSelectionMode={multiSelectionMode}
          keyboardFocusItemId={keyboardFocusItemId}
          lensActive={lensActive}
          highlightedItemIds={highlightedItemIds}
          guidedDestinationId={guidedDestination?.destinationId}
          guidedItemTitle={guidedDestination?.itemTitle}
          inventionStage={game.inventionStage}
          progress={progress}
          worldBounds={WORLD_BOUNDS}
          toastText={toast}
          compactLargeTextGuidance={shortHeightLargeTextGuidance}
        />
        <div className="world-overlay-host" ref={setWorldOverlayHost} />
        {activeRightPanel === 'inspector' && (
          <ItemInspector
            item={selectedItem}
            selectedItems={selectedItemIds.map((itemId) => game.items.find((item) => item.id === itemId)).filter(Boolean)}
            collections={COLLECTIONS}
            destinations={DESTINATIONS}
            scratchPads={scratchPads}
            focusMoveItemId={keyboardFocusItemId}
            onClose={closeInspector}
            onFocus={(item) => worldRef.current?.focusItem(item)}
            onMove={(itemOrItems, target) => Array.isArray(itemOrItems)
              ? handleBatchInspectorMove(itemOrItems, target)
              : handleInspectorMove(itemOrItems, target)}
          />
        )}
        {activeRightPanel === 'puzzle' && activePuzzle && (
          <PuzzlePanel puzzle={activePuzzle} solved={puzzleSolved} unlockedPuzzles={unlockedPuzzles} onSelectPuzzle={setActivePuzzleId} onSolve={handleSolvePuzzle} onClose={closePuzzle} />
        )}
        <div className="sr-only" aria-live="polite" data-testid="skill-announcer">{lensMessage}</div>
        <div className="game-save-indicator" aria-live="polite" data-testid="autosave-status">{saveStatus}</div>
      </main>

      {saveOpen && (
        <SaveDialog
          encodedSave={saveText}
          saveStatus={saveStatus}
          onClose={() => setSaveOpen(false)}
          onImport={handleImportSave}
          onStartNewGame={handleStartNewGame}
        />
      )}
      {howToPlayOpen && (
        <HowToPlayDialog
          onClose={() => setHowToPlayOpen(false)}
          onBeginFirstTask={handleBeginFirstTask}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          preferences={preferences}
          saveStatus={preferencesStatus}
          onChange={handlePreferenceChange}
          onPreviewSound={handleAudioPreview}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {completionOpen && (
        <CompletionSequence
          stats={completionStats}
          userReducedMotion={preferences.reduceMotion}
          onReturnFocusFallback={saveOpen ? null : handleCompletionFocusReturn}
          onContinue={() => {
            setCompletionOpen(false);
            setSaveOpen(false);
          }}
        />
      )}
    </div>
  );
}
