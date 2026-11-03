import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { worldToScreen } from '../game/world/camera.js';
import { buildAtlasDensity, createWorldAtlasProjection } from '../game/world/atlasMap.js';
import { getRenderMode } from '../game/world/renderPolicy.js';
import { isCollectionComplete } from '../game/domain/completion.js';
import { DestinationCard } from './DestinationCard.jsx';
import { InventionCore } from './InventionCore.jsx';
import { ItemFinder } from './ItemFinder.jsx';
import { LabObject } from './LabObject.jsx';
import { ScratchPad } from './ScratchPad.jsx';
import { WorldAtlasPanel } from './WorldAtlasPanel.jsx';
import { WorldOverviewCanvas } from './WorldOverviewCanvas.jsx';
import { getResonanceLensMatches } from '../game/domain/skillHighlights.js';
import { shouldShowCalibrationLead } from '../game/domain/firstActionLead.js';
import { createStartingCamera } from '../game/persistence/gameState.js';
import { EMPTY_HIGHLIGHTED_ITEM_IDS } from './highlightedItemIds.js';
import { useWorldViewportController } from './useWorldViewportController.js';

function isNearViewport(item, bounds) {
  const x = item.position?.x ?? 0;
  const y = item.position?.y ?? 0;
  const width = item.width ?? 100;
  const height = item.height ?? 70;
  return x + width >= bounds.x && x <= bounds.x + bounds.width && y + height >= bounds.y && y <= bounds.y + bounds.height;
}

function worldDimensions(bounds) {
  const x = bounds?.x ?? bounds?.left ?? bounds?.minX ?? 0;
  const y = bounds?.y ?? bounds?.top ?? bounds?.minY ?? 0;
  const width = bounds?.width ?? ((bounds?.maxX ?? 5200) - x);
  const height = bounds?.height ?? ((bounds?.maxY ?? 3800) - y);
  return { x, y, width, height };
}

const OVERVIEW_OVERLAY_LIMIT = 64;
const TITLE_REVEAL_INSET = 8;
const EMPTY_ITEM_IDS = new Set();
const EMPTY_HIGHLIGHT_SOURCES = Object.freeze([]);
const LENS_HIGHLIGHT_SOURCES = Object.freeze(['Resonance Lens']);
const COMPASS_HIGHLIGHT_SOURCES = Object.freeze(['Missing Member Compass']);
const ALL_HIGHLIGHT_SOURCES = Object.freeze(['Resonance Lens', 'Missing Member Compass']);
const ATLAS_VIEWBOX = Object.freeze({ width: 520, height: 340 });
const ATLAS_GRID = Object.freeze({ columns: 24, rows: 16 });
const ATLAS_PADDING = 20;

function getAtlasPoint(event, element) {
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: ((event.clientX - rect.left) / rect.width) * ATLAS_VIEWBOX.width,
    y: ((event.clientY - rect.top) / rect.height) * ATLAS_VIEWBOX.height,
  };
}

function getAtlasLocation(point, landmarks) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const landmark of landmarks) {
    const distance = Math.hypot(point.x - landmark.position.x, point.y - landmark.position.y);
    if (distance < nearestDistance) {
      nearest = landmark;
      nearestDistance = distance;
    }
  }
  return nearest?.label ?? 'the laboratory';
}

function getAtlasStatus(point, landmarks, scale, prefix = 'Map centered') {
  return `${prefix} near ${getAtlasLocation(point, landmarks)}; ${Math.round(scale * 100)}% zoom.`;
}

function getCameraCenteredOn(point, scale, viewportSize) {
  const screenPoint = worldToScreen(point, { panX: 0, panY: 0, scale });
  return {
    panX: viewportSize.width / 2 - screenPoint.x,
    panY: viewportSize.height / 2 - screenPoint.y,
    scale,
  };
}

function getLocalTitleRevealShift(button, scene, screenX, screenY) {
  if (typeof DOMMatrixReadOnly === 'undefined') {
    const inverseScale = Number.parseFloat(getComputedStyle(scene).getPropertyValue('--inverse-camera-scale')) || 1;
    return { x: screenX * inverseScale, y: screenY * inverseScale };
  }

  const sceneTransform = getComputedStyle(scene).transform;
  const buttonTransform = getComputedStyle(button).transform;
  const sceneMatrix = new DOMMatrixReadOnly(sceneTransform === 'none' ? undefined : sceneTransform);
  const buttonMatrix = new DOMMatrixReadOnly(buttonTransform === 'none' ? undefined : buttonTransform);
  const combined = sceneMatrix.multiply(buttonMatrix);
  const determinant = combined.a * combined.d - combined.b * combined.c;
  if (!determinant) return { x: screenX, y: screenY };
  return {
    x: (combined.d * screenX - combined.c * screenY) / determinant,
    y: (-combined.b * screenX + combined.a * screenY) / determinant,
  };
}

function positionActiveTitleReveals(viewport) {
  if (!viewport) return;
  const viewportRect = viewport.getBoundingClientRect();
  const availableWidth = Math.max(1, viewportRect.width - TITLE_REVEAL_INSET * 2);
  const availableHeight = Math.max(1, viewportRect.height - TITLE_REVEAL_INSET * 2);
  const reveals = viewport.querySelectorAll('.lab-object:is(:hover, :focus-visible, .is-selected) > .lab-object-title-reveal');

  reveals.forEach((reveal) => {
    const button = reveal.parentElement;
    const scene = reveal.closest('.world-scene');
    if (!button || !scene) return;

    reveal.style.setProperty('--title-reveal-shift-x', '0px');
    reveal.style.setProperty('--title-reveal-shift-y', '0px');
    reveal.style.maxWidth = `${availableWidth}px`;
    reveal.style.maxHeight = `${availableHeight}px`;
    reveal.style.overflowY = 'auto';

    const revealRect = reveal.getBoundingClientRect();
    const minX = viewportRect.left + TITLE_REVEAL_INSET;
    const maxX = viewportRect.right - TITLE_REVEAL_INSET;
    const minY = viewportRect.top + TITLE_REVEAL_INSET;
    const maxY = viewportRect.bottom - TITLE_REVEAL_INSET;
    const shiftX = revealRect.width <= maxX - minX
      ? Math.max(minX - revealRect.left, Math.min(0, maxX - revealRect.right))
      : minX - revealRect.left;
    const shiftY = revealRect.height <= maxY - minY
      ? Math.max(minY - revealRect.top, Math.min(0, maxY - revealRect.bottom))
      : minY - revealRect.top;
    const localShift = getLocalTitleRevealShift(button, scene, shiftX, shiftY);
    reveal.style.setProperty('--title-reveal-shift-x', `${localShift.x}px`);
    reveal.style.setProperty('--title-reveal-shift-y', `${localShift.y}px`);
  });
}

export const WorldViewport = forwardRef(function WorldViewport({
  items,
  destinations,
  scratchPads,
  collections,
  camera,
  onCameraChange,
  onDrop,
  onSelectItem,
  onToggleItemSelection,
  onToggleSelectionMode,
  onOpenFinder,
  selectedItemId,
  selectedItemIds = [],
  multiSelectionMode = false,
  onOpenAtlas,
  keyboardFocusItemId,
  lensActive,
  highlightedItemIds = EMPTY_HIGHLIGHTED_ITEM_IDS,
  guidedDestinationId,
  guidedItemTitle,
  inventionStage,
  progress,
  worldBounds,
  toastText = '',
  overlayRoot = null,
}, ref) {
  const viewportRef = useRef(null);
  const sceneRef = useRef(null);
  const findButtonRef = useRef(null);
  const selectionToggleButtonRef = useRef(null);
  const atlasToggleRef = useRef(null);
  const atlasMapRef = useRef(null);
  const atlasGestureRef = useRef(null);
  const atlasPointerRafRef = useRef(null);
  const atlasLatestPointerRef = useRef(null);
  const titleRevealRafRef = useRef(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [atlasCamera, setAtlasCamera] = useState(camera ?? { panX: 0, panY: 0, scale: 0.8 });
  const [atlasCrosshair, setAtlasCrosshair] = useState(null);
  const [atlasStatus, setAtlasStatus] = useState('Use arrow keys to move the map crosshair. Press Enter to center.');
  const [zoomAnnouncement, setZoomAnnouncement] = useState('');
  const atlasOpenRef = useRef(false);
  const closeAtlasRef = useRef(null);
  const closeFinderRef = useRef(null);
  const previousZoomScaleRef = useRef(null);
  const previousPinchActiveRef = useRef(false);
  const lastAnnouncedZoomPercentRef = useRef(null);
  const zoomAnnouncementTimerRef = useRef(null);
  const renderModeRef = useRef('detail');

  const onCameraPreview = useCallback((nextCamera) => {
    if (atlasOpenRef.current) setAtlasCamera(nextCamera);
  }, []);
  const positionTitleReveals = useCallback(() => {
    positionActiveTitleReveals(viewportRef.current);
  }, []);
  const {
    cameraRef,
    cullingCamera,
    cullingRevision,
    commitCamera,
    dragPreview,
    fitTargetScale,
    focusWorldPoint,
    pinchActive,
    onLostPointerCapture: onViewportLostPointerCapture,
    onPointerCancel: onViewportPointerCancel,
    onPointerDown: onViewportPointerDown,
    onPointerMove: onViewportPointerMove,
    onPointerUp: onViewportPointerUp,
    onWheel,
    scheduleCamera,
    size,
    visibleBounds,
    visibleItems,
    zoomBy,
  } = useWorldViewportController({
    camera,
    items,
    multiSelectionMode,
    onCameraChange,
    onCameraApplied: positionTitleReveals,
    onCameraPreview,
    onDrop,
    onSelectItem,
    onToggleItemSelection,
    onViewportResize: positionTitleReveals,
    renderModeRef,
    sceneRef,
    viewportRef,
  });
  const focusStartingView = useCallback(() => {
    commitCamera(createStartingCamera(), { refreshCulling: true });
  }, [commitCamera]);
  const bounds = useMemo(() => worldDimensions(worldBounds), [worldBounds]);
  const atlasProjection = useMemo(() => createWorldAtlasProjection(bounds, ATLAS_VIEWBOX, ATLAS_PADDING), [bounds]);
  const atlasDensity = useMemo(
    () => buildAtlasDensity(items, bounds, ATLAS_GRID.columns, ATLAS_GRID.rows),
    [bounds, items],
  );
  const atlasLandmarks = useMemo(() => [
    ...destinations.map((destination) => ({
      id: destination.id,
      kind: 'destination',
      label: destination.label,
      position: {
        x: destination.position.x + (destination.width ?? 0) / 2,
        y: destination.position.y + (destination.height ?? 0) / 2,
      },
    })),
    ...scratchPads.map((pad) => ({
      id: pad.id,
      kind: 'scratchpad',
      label: pad.label,
      position: {
        x: pad.position.x + (pad.width ?? 0) / 2,
        y: pad.position.y + (pad.height ?? 0) / 2,
      },
    })),
    {
      id: 'engine',
      kind: 'engine',
      label: 'Palimpsest Engine',
      position: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    },
  ], [bounds.height, bounds.width, bounds.x, bounds.y, destinations, scratchPads]);

  const scheduleTitleRevealPosition = useCallback(() => {
    if (titleRevealRafRef.current !== null) return;
    titleRevealRafRef.current = requestAnimationFrame(() => {
      titleRevealRafRef.current = null;
      positionActiveTitleReveals(viewportRef.current);
    });
  }, []);

  useLayoutEffect(() => {
    positionActiveTitleReveals(viewportRef.current);
  }, [
    cullingCamera.panX,
    cullingCamera.panY,
    cullingCamera.scale,
    dragPreview?.id,
    dragPreview?.position?.x,
    dragPreview?.position?.y,
    keyboardFocusItemId,
    selectedItemId,
    selectedItemIds,
    size.height,
    size.width,
  ]);

  useEffect(() => () => {
    if (titleRevealRafRef.current !== null) cancelAnimationFrame(titleRevealRafRef.current);
  }, []);

  useEffect(() => {
    const previousScale = previousZoomScaleRef.current;
    previousZoomScaleRef.current = cullingCamera.scale;
    const percent = Math.round(cullingCamera.scale * 100);
    const pinchEnding = previousPinchActiveRef.current && !pinchActive;
    previousPinchActiveRef.current = pinchActive;

    if (previousScale === null) {
      lastAnnouncedZoomPercentRef.current = percent;
      return undefined;
    }

    if (pinchActive) {
      if (zoomAnnouncementTimerRef.current !== null) {
        window.clearTimeout(zoomAnnouncementTimerRef.current);
        zoomAnnouncementTimerRef.current = null;
      }
      return undefined;
    }

    if (percent === lastAnnouncedZoomPercentRef.current
      || (previousScale === cullingCamera.scale && !pinchEnding)) return undefined;

    const timerId = window.setTimeout(() => {
      zoomAnnouncementTimerRef.current = null;
      lastAnnouncedZoomPercentRef.current = percent;
      setZoomAnnouncement(`Zoom ${percent}%`);
    }, 220);
    zoomAnnouncementTimerRef.current = timerId;

    return () => {
      window.clearTimeout(timerId);
      if (zoomAnnouncementTimerRef.current === timerId) zoomAnnouncementTimerRef.current = null;
    };
  }, [cullingCamera.scale, pinchActive]);

  useEffect(() => {
    const rootObserver = new MutationObserver(scheduleTitleRevealPosition);
    rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => rootObserver.disconnect();
  }, [scheduleTitleRevealPosition]);

  const destinationCounts = useMemo(() => {
    const counts = new Map(destinations.map((destination) => [destination.id, 0]));
    for (const item of items) {
      if (item.placement?.kind !== 'destination') continue;
      const id = item.placement.destinationId ?? item.placement.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [destinations, items]);

  const scratchPadCounts = useMemo(() => {
    const counts = new Map(scratchPads.map((pad) => [pad.id, 0]));
    for (const item of items) {
      if (item.placement?.kind !== 'scratchpad') continue;
      const id = item.placement.scratchPadId ?? item.placement.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [items, scratchPads]);

  useImperativeHandle(ref, () => ({
    focusPoint: focusWorldPoint,
    focusSelectionToggle() {
      selectionToggleButtonRef.current?.focus();
    },
    focusItem(item) {
      if (item?.position) focusWorldPoint({ x: item.position.x + (item.width ?? 0) / 2, y: item.position.y + (item.height ?? 0) / 2 });
    },
    focusItemControl(itemIds) {
      const candidates = (Array.isArray(itemIds) ? itemIds : [itemIds]).filter(Boolean);
      const controls = Array.from(viewportRef.current?.querySelectorAll('.lab-object[data-item-id]') ?? []);
      for (const itemId of candidates) {
        const control = controls.find((entry) => entry.dataset.itemId === itemId);
        if (control) {
          control.focus();
          if (document.activeElement === control) return true;
        }
      }
      return false;
    },
    focusDestination(destination, preferredScale = cameraRef.current.scale, { fitToViewport = false } = {}) {
      if (destination?.position) {
        const fittedScale = fitTargetScale(destination, preferredScale);
        const scale = !fitToViewport && destination.id === 'cabinet-calibration'
          ? Math.min(0.5, fittedScale)
          : fittedScale;
        focusWorldPoint({ x: destination.position.x + (destination.width ?? 250) / 2, y: destination.position.y + (destination.height ?? 170) / 2 }, scale);
      }
    },
    focusScratchPad(pad, preferredScale = cameraRef.current.scale) {
      if (pad?.position) focusWorldPoint({ x: pad.position.x + (pad.width ?? 0) / 2, y: pad.position.y + (pad.height ?? 0) / 2 }, fitTargetScale(pad, preferredScale));
    },
    closeAtlas(options) {
      closeAtlasRef.current?.(options);
    },
    closeFinder(options) {
      closeFinderRef.current?.(options);
    },
    reset() {
      focusStartingView();
    },
  }), [fitTargetScale, focusStartingView, focusWorldPoint]);

  const renderMode = getRenderMode({
    currentMode: renderModeRef.current,
    scale: cullingCamera.scale,
    visibleCount: visibleItems.length,
  });
  renderModeRef.current = renderMode;
  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const groupSelectionActive = multiSelectionMode || selectedItemIds.length > 0;
  const forcedItemIds = useMemo(() => new Set(
    [selectedItemId, ...selectedItemIds, keyboardFocusItemId, dragPreview?.id].filter(Boolean),
  ), [dragPreview?.id, keyboardFocusItemId, selectedItemId, selectedItemIds]);
  const overviewExcludedItemIds = renderMode === 'overview' ? forcedItemIds : EMPTY_ITEM_IDS;
  const renderedItems = useMemo(() => {
    const forcedItems = items.filter((item) => forcedItemIds.has(item.id));
    if (renderMode === 'detail') {
      const visibleIds = new Set(visibleItems.map((item) => item.id));
      return [...visibleItems, ...forcedItems.filter((item) => !visibleIds.has(item.id))];
    }
    const ordinaryItems = visibleItems.filter((item) => !forcedItemIds.has(item.id))
      .slice(0, Math.max(0, OVERVIEW_OVERLAY_LIMIT - forcedItemIds.size));
    const ordinaryIds = new Set(ordinaryItems.map((item) => item.id));
    return [...ordinaryItems, ...forcedItems.filter((item) => !ordinaryIds.has(item.id))];
  }, [forcedItemIds, items, renderMode, visibleItems]);
  const visibleDestinations = useMemo(() => destinations.filter((destination) => isNearViewport(destination, visibleBounds)), [destinations, visibleBounds]);
  const visibleScratchPads = useMemo(() => scratchPads.filter((pad) => isNearViewport(pad, visibleBounds)), [scratchPads, visibleBounds]);
  const completeIds = progress?.completedCollectionIds ?? [];
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedItemId) ?? null, [items, selectedItemId]);
  const highlightedItemIdSet = useMemo(() => new Set(highlightedItemIds), [highlightedItemIds]);
  const lensMatches = useMemo(
    () => lensActive ? getResonanceLensMatches(items, selectedItem) : [],
    [items, lensActive, selectedItem],
  );
  const lensHighlightedItemIdSet = useMemo(() => new Set(lensMatches.map((item) => item.id)), [lensMatches]);
  const overviewHighlightedItemIdSet = useMemo(
    () => new Set([...lensHighlightedItemIdSet, ...highlightedItemIdSet]),
    [highlightedItemIdSet, lensHighlightedItemIdSet],
  );
  const renderedItemIdSet = useMemo(() => new Set(renderedItems.map((item) => item.id)), [renderedItems]);
  const canvasOnlyHighlightedTitles = useMemo(() => renderMode === 'overview'
    ? items
      .filter((item) => overviewHighlightedItemIdSet.has(item.id) && !renderedItemIdSet.has(item.id))
      .map((item) => item.title ?? 'Uncatalogued object')
    : [], [items, overviewHighlightedItemIdSet, renderMode, renderedItemIdSet]);
  const inventionCenter = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const invention = {
    position: {
      x: inventionCenter.x - 340 / 2,
      y: inventionCenter.y - 260 / 2,
    },
    width: 340,
    height: 260,
  };
  const showInvention = isNearViewport(invention, visibleBounds);

  const atlasWorldPointFromEvent = useCallback((event) => (
    atlasProjection.unprojectPoint(getAtlasPoint(event, atlasMapRef.current))
  ), [atlasProjection]);

  const recenterAtlas = useCallback((worldPoint, prefix = 'Map centered') => {
    const point = atlasProjection.unprojectPoint(worldPoint);
    const scale = cameraRef.current.scale;
    focusWorldPoint(point, scale);
    setAtlasCrosshair(point);
    setAtlasStatus(getAtlasStatus(point, atlasLandmarks, scale, prefix));
  }, [atlasLandmarks, atlasProjection, focusWorldPoint]);

  const finishAtlasPointerGesture = useCallback((event) => {
    const gesture = atlasGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const localPoint = getAtlasPoint(event, atlasMapRef.current);
    const worldPoint = atlasProjection.unprojectPoint(localPoint);
    atlasGestureRef.current = null;
    atlasLatestPointerRef.current = null;
    if (atlasPointerRafRef.current !== null) {
      cancelAnimationFrame(atlasPointerRafRef.current);
      atlasPointerRafRef.current = null;
    }
    const scale = cameraRef.current.scale;
    commitCamera(getCameraCenteredOn(worldPoint, scale, size));
    setAtlasCrosshair(worldPoint);
    setAtlasStatus(getAtlasStatus(worldPoint, atlasLandmarks, scale));
    try { atlasMapRef.current?.releasePointerCapture(event.pointerId); } catch { /* Capture may already have been released. */ }
  }, [atlasLandmarks, atlasProjection, commitCamera, size.height, size.width]);

  const onAtlasPointerDown = useCallback((event) => {
    event.stopPropagation();
    if (event.target.closest?.('button, a, input, select, textarea')) return;
    if (event.button !== 0) return;
    event.preventDefault();
    const localPoint = getAtlasPoint(event, atlasMapRef.current);
    atlasGestureRef.current = {
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      latestPoint: localPoint,
      moved: false,
    };
    atlasLatestPointerRef.current = localPoint;
    try { atlasMapRef.current?.setPointerCapture(event.pointerId); } catch { /* Capture can fail when the pointer was already released. */ }
  }, []);

  const onAtlasPointerMove = useCallback((event) => {
    event.stopPropagation();
    const gesture = atlasGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - gesture.startClient.x, event.clientY - gesture.startClient.y);
    if (distance >= 3) gesture.moved = true;
    const localPoint = getAtlasPoint(event, atlasMapRef.current);
    gesture.latestPoint = localPoint;
    atlasLatestPointerRef.current = localPoint;
    if (!gesture.moved || atlasPointerRafRef.current !== null) return;
    atlasPointerRafRef.current = requestAnimationFrame(() => {
      atlasPointerRafRef.current = null;
      const latestPoint = atlasLatestPointerRef.current;
      if (!latestPoint || !atlasGestureRef.current) return;
      const worldPoint = atlasProjection.unprojectPoint(latestPoint);
      scheduleCamera(getCameraCenteredOn(worldPoint, cameraRef.current.scale, size));
    });
  }, [atlasProjection, scheduleCamera, size.height, size.width]);

  const onAtlasPointerUp = useCallback((event) => {
    event.stopPropagation();
    finishAtlasPointerGesture(event);
  }, [finishAtlasPointerGesture]);

  const onAtlasPointerCancel = useCallback((event) => {
    event.stopPropagation();
    const gesture = atlasGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    atlasGestureRef.current = null;
    atlasLatestPointerRef.current = null;
    if (atlasPointerRafRef.current !== null) {
      cancelAnimationFrame(atlasPointerRafRef.current);
      atlasPointerRafRef.current = null;
    }
    commitCamera(cameraRef.current);
    try { atlasMapRef.current?.releasePointerCapture(event.pointerId); } catch { /* Capture may already have been released. */ }
  }, [commitCamera]);

  const onAtlasWheel = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const closeAtlas = useCallback(({ restoreFocus = true, restoreFocusIfAtlasFocused = false } = {}) => {
    const atlasHasFocus = Boolean(
      atlasMapRef.current?.closest('.world-atlas-panel')?.contains(document.activeElement),
    );
    atlasOpenRef.current = false;
    setAtlasOpen(false);
    const gesture = atlasGestureRef.current;
    if (gesture) {
      atlasGestureRef.current = null;
      atlasLatestPointerRef.current = null;
      if (atlasPointerRafRef.current !== null) {
        cancelAnimationFrame(atlasPointerRafRef.current);
        atlasPointerRafRef.current = null;
      }
      commitCamera(cameraRef.current);
      try { atlasMapRef.current?.releasePointerCapture(gesture.pointerId); } catch { /* Capture may already have been released. */ }
    }
    if (restoreFocus || (restoreFocusIfAtlasFocused && atlasHasFocus)) atlasToggleRef.current?.focus();
  }, [commitCamera]);
  closeAtlasRef.current = closeAtlas;

  const toggleAtlas = useCallback(() => {
    if (atlasOpenRef.current) {
      closeAtlas();
      return;
    }
    if (finderOpen) setFinderOpen(false);
    onOpenAtlas?.();
    atlasOpenRef.current = true;
    setAtlasOpen(true);
    setAtlasCamera(cameraRef.current);
    setAtlasCrosshair({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
  }, [bounds.height, bounds.width, bounds.x, bounds.y, closeAtlas, finderOpen, onOpenAtlas]);

  const onAtlasKeyDown = useCallback((event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAtlas();
      return;
    }
    if (event.key === 'Enter' && event.target.closest?.('.world-atlas-close')) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const point = atlasCrosshair ?? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      recenterAtlas(point);
      return;
    }
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = directions[event.key];
    if (!delta) return;
    event.preventDefault();
    const currentPoint = atlasCrosshair ?? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const nextPoint = {
      x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, currentPoint.x + (bounds.width / ATLAS_GRID.columns) * delta[0])),
      y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, currentPoint.y + (bounds.height / ATLAS_GRID.rows) * delta[1])),
    };
    setAtlasCrosshair(nextPoint);
    setAtlasStatus(getAtlasStatus(nextPoint, atlasLandmarks, cameraRef.current.scale, 'Map crosshair moved'));
  }, [atlasCrosshair, atlasLandmarks, bounds.height, bounds.width, bounds.x, bounds.y, closeAtlas, recenterAtlas]);

  useEffect(() => {
    if (!atlasOpen) return;
    atlasMapRef.current?.focus();
    setAtlasCamera(cameraRef.current);
    setAtlasCrosshair({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
    setAtlasStatus('Atlas open. Use arrow keys to move the crosshair; press Enter to center it.');
  }, [atlasOpen, bounds.height, bounds.width, bounds.x, bounds.y]);

  const itemCount = items.length;
  const collectionById = useMemo(() => new Map(collections.map((collection) => [collection.id, collection])), [collections]);
  const showCalibrationLead = shouldShowCalibrationLead({
    items,
    collection: collectionById.get('harmonic-calibration'),
  });
  const unfinishedCollectionNavigation = useMemo(() => {
    const availableItems = Array.isArray(items) ? items.filter((item) => item && typeof item.id === 'string') : [];
    const availableCollections = Array.isArray(collections) ? collections : [];
    const itemsById = new Map(availableItems.map((item) => [item.id, item]));
    const options = [];
    const firstUnfinishedByCollectionId = new Map();

    for (const collection of availableCollections) {
      if (!collection || typeof collection.id !== 'string' || !Array.isArray(collection.itemIds)
        || collection.itemIds.length === 0 || typeof collection.destinationId !== 'string') continue;

      let correctCount = 0;
      let firstUnfinished = null;
      for (const itemId of collection.itemIds) {
        if (typeof itemId !== 'string') continue;
        const item = itemsById.get(itemId);
        const placement = item?.placement;
        const destinationId = placement?.destinationId ?? placement?.id;
        const correctlyFiled = item?.validation === 'correct'
          && placement?.kind === 'destination'
          && destinationId === collection.destinationId;

        if (correctlyFiled) {
          correctCount += 1;
        } else if (!firstUnfinished && item && Number.isFinite(item.position?.x) && Number.isFinite(item.position?.y)) {
          firstUnfinished = item;
        }
      }

      if (correctCount >= collection.itemIds.length || !firstUnfinished) continue;
      options.push({
        id: collection.id,
        label: collection.label ?? collection.name ?? collection.id,
        correctCount,
        total: collection.itemIds.length,
      });
      firstUnfinishedByCollectionId.set(collection.id, firstUnfinished);
    }

    return { options, firstUnfinishedByCollectionId };
  }, [collections, items]);

  const closeFinder = ({ restoreFocus = true, restoreFocusIfFinderFocused = false } = {}) => {
    const finderHasFocus = Boolean(document.activeElement?.closest?.('.world-item-finder'));
    setFinderOpen(false);
    if (restoreFocus || (restoreFocusIfFinderFocused && finderHasFocus)) findButtonRef.current?.focus();
  };
  closeFinderRef.current = closeFinder;

  const selectFinderItem = (item, activation = {}) => {
    setFinderOpen(false);
    if (multiSelectionMode) onToggleItemSelection(item.id, { keyboard: activation.keyboard === true });
    else onSelectItem(item.id, { keyboard: activation.keyboard === true });
    if (item.position) {
      focusWorldPoint({
        x: item.position.x + (item.width ?? 0) / 2,
        y: item.position.y + (item.height ?? 0) / 2,
      }, Math.max(0.72, cameraRef.current.scale));
    }
  };

  const toggleFinder = () => {
    if (finderOpen) {
      closeFinder();
      return;
    }
    if (atlasOpenRef.current) closeAtlas();
    onOpenFinder?.();
    setFinderOpen(true);
  };

  const jumpTo = (value) => {
    if (value === 'start') {
      focusStartingView();
      return;
    }
    if (value === 'engine') {
      focusWorldPoint({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, fitTargetScale(invention, 1));
      return;
    }
    const [kind, id] = value.split(':');
    if (kind === 'collection') {
      const item = unfinishedCollectionNavigation.firstUnfinishedByCollectionId.get(id);
      if (item?.position) {
        focusWorldPoint({
          x: item.position.x + (item.width ?? 0) / 2,
          y: item.position.y + (item.height ?? 0) / 2,
        }, Math.max(0.72, cameraRef.current.scale));
      }
      return;
    }
    if (kind === 'destination') {
      const destination = destinations.find((entry) => entry.id === id);
      if (destination) focusWorldPoint({ x: destination.position.x + destination.width / 2, y: destination.position.y + destination.height / 2 }, fitTargetScale(destination, 0.76));
    }
    if (kind === 'scratchpad') {
      const pad = scratchPads.find((entry) => entry.id === id);
      if (pad) focusWorldPoint({ x: pad.position.x + pad.width / 2, y: pad.position.y + pad.height / 2 }, 0.72);
    }
  };

  return (
    <>
    <section
      className="world-viewport"
      ref={viewportRef}
      role="region"
      aria-label="Laboratory world. Drag empty space to pan, use the wheel or pinch to zoom, or use arrow keys while focused."
      tabIndex={0}
      data-drop-kind="workspace"
      data-testid="world-viewport"
      data-culling-revision={cullingRevision}
      onPointerDown={onViewportPointerDown}
      onPointerMove={onViewportPointerMove}
      onPointerUp={onViewportPointerUp}
      onPointerCancel={onViewportPointerCancel}
      onLostPointerCapture={onViewportLostPointerCapture}
      onPointerOver={(event) => {
        if (event.target.closest?.('.lab-object')) scheduleTitleRevealPosition();
      }}
      onFocusCapture={(event) => {
        if (event.target.matches?.('.lab-object')) scheduleTitleRevealPosition();
      }}
      onWheel={onWheel}
      onKeyDown={(event) => {
        if (event.target?.closest?.('.world-item-finder, .world-atlas-panel')) return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
        const step = event.shiftKey ? 180 : 90;
        const directions = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        const delta = directions[event.key];
        if (delta) {
          event.preventDefault();
          const currentCamera = cameraRef.current;
          commitCamera({ ...currentCamera, panX: currentCamera.panX + delta[0], panY: currentCamera.panY + delta[1] });
        }
      }}
    >
      <div className="world-scene" ref={sceneRef} style={{ transform: `translate(${cullingCamera.panX}px, ${cullingCamera.panY}px) scale(${cullingCamera.scale})`, transformOrigin: '0 0', width: bounds.width, height: bounds.height, '--inverse-camera-scale': String(1 / cullingCamera.scale) }}>
        <div className="world-ground" aria-hidden="true" style={{ position: 'absolute', left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, pointerEvents: 'none' }} />
        <WorldOverviewCanvas
          items={items}
          width={bounds.width}
          height={bounds.height}
          visible={renderMode === 'overview'}
          excludedItemIds={overviewExcludedItemIds}
          highlightedItemIds={overviewHighlightedItemIdSet}
        />
        {visibleDestinations.map((destination) => {
          const collection = destination.collectionId ? collectionById.get(destination.collectionId) : null;
          const complete = collection && isCollectionComplete(collection, items);
          return (
            <DestinationCard
              key={destination.id}
              destination={destination}
              placedCount={destinationCounts.get(destination.id) ?? 0}
              complete={Boolean(complete)}
              guided={destination.id === guidedDestinationId}
              guidedItemTitle={destination.id === guidedDestinationId ? guidedItemTitle : undefined}
              onFocus={(target) => focusWorldPoint({ x: target.position.x + (target.width ?? 250) / 2, y: target.position.y + (target.height ?? 170) / 2 })}
            />
          );
        })}
        {visibleScratchPads.map((pad) => {
          const count = scratchPadCounts.get(pad.id) ?? 0;
          return <ScratchPad key={pad.id} pad={pad} itemCount={count} onFocus={(target) => focusWorldPoint({ x: target.position.x + target.width / 2, y: target.position.y + target.height / 2 })} />;
        })}
        {showInvention && (
          <div className="invention-anchor" style={{ left: inventionCenter.x, top: inventionCenter.y }}>
            <InventionCore stage={inventionStage} completedCollections={completeIds.length} solvedPuzzles={(progress?.solvedPuzzleIds ?? []).length} />
          </div>
        )}
        {renderedItems.map((item) => {
          const position = dragPreview?.id === item.id ? dragPreview.position : item.position;
          const itemWithPreview = position === item.position ? item : { ...item, position };
          const selected = selectedItemId === item.id || selectedItemIdSet.has(item.id);
          const pressed = groupSelectionActive ? selectedItemIdSet.has(item.id) : selectedItemId === item.id;
          const lensHighlighted = lensHighlightedItemIdSet.has(item.id);
          const compassHighlighted = highlightedItemIdSet.has(item.id);
          const highlightSources = lensHighlighted
            ? compassHighlighted ? ALL_HIGHLIGHT_SOURCES : LENS_HIGHLIGHT_SOURCES
            : compassHighlighted ? COMPASS_HIGHLIGHT_SOURCES : EMPTY_HIGHLIGHT_SOURCES;
          return (
            <LabObject
              key={item.id}
              item={itemWithPreview}
              selected={selected}
              pressed={pressed}
              highlightSources={highlightSources}
              dragging={dragPreview?.id === item.id}
              onSelect={multiSelectionMode ? onToggleItemSelection : onSelectItem}
            />
          );
        })}
      </div>
      {canvasOnlyHighlightedTitles.length > 0 && (
        <section
          className="sr-only"
          aria-label="Canvas-only highlighted item titles"
          data-testid="canvas-only-highlight-titles"
        >
          {canvasOnlyHighlightedTitles.join(', ')}
        </section>
      )}
      {finderOpen && <ItemFinder items={items} onSelectItem={selectFinderItem} onClose={closeFinder} />}
      <button
        ref={atlasToggleRef}
        className="hud-control world-atlas-toggle"
        type="button"
        data-testid="world-atlas-toggle"
        aria-label={atlasOpen ? 'Close Clockwork Atlas' : 'Open Clockwork Atlas'}
        aria-expanded={atlasOpen}
        aria-controls="world-atlas-panel"
        onClick={toggleAtlas}
      >
        Atlas
      </button>
      {atlasOpen && (
        <WorldAtlasPanel
          atlasCamera={atlasCamera}
          atlasCrosshair={atlasCrosshair}
          atlasDensity={atlasDensity}
          atlasLandmarks={atlasLandmarks}
          atlasMapRef={atlasMapRef}
          atlasProjection={atlasProjection}
          atlasStatus={atlasStatus}
          bounds={bounds}
          closeAtlas={closeAtlas}
          grid={ATLAS_GRID}
          itemCount={itemCount}
          onAtlasKeyDown={onAtlasKeyDown}
          onAtlasPointerCancel={onAtlasPointerCancel}
          onAtlasPointerDown={onAtlasPointerDown}
          onAtlasPointerMove={onAtlasPointerMove}
          onAtlasPointerUp={onAtlasPointerUp}
          onAtlasWheel={onAtlasWheel}
          onLandmarkFocus={setAtlasCrosshair}
          onLandmarkRecenter={recenterAtlas}
          onPanelPointerDown={(event) => {
            if (event.target.closest?.('.world-atlas-map')) onAtlasPointerDown(event);
            else event.stopPropagation();
          }}
          onPanelPointerMove={(event) => {
            if (event.target.closest?.('.world-atlas-map') || atlasGestureRef.current) onAtlasPointerMove(event);
            else event.stopPropagation();
          }}
          size={size}
          viewBox={ATLAS_VIEWBOX}
        />
      )}
      <div className="sr-only" role="status" aria-live="polite" data-testid="zoom-announcer">{zoomAnnouncement}</div>
      <div className="sr-only" aria-live="polite" data-testid="world-announcer" />
    </section>
    {overlayRoot && createPortal(
      <div className="world-bottom-stack">
        <p className="world-hint">{multiSelectionMode
          ? <>
            <span className="world-hint__mouse-selection">Click or press Enter on objects to select them</span>
            <span className="world-hint__touch-selection">Tap or press Enter on objects to select them</span>
            {' '}· use the Inspector to move the group ·{' '}
            <span className="world-hint__mouse-guidance">drag empty space to pan · wheel to zoom</span>
            <span className="world-hint__touch-guidance">drag empty space to pan · pinch to zoom</span>
          </>
          : <>
            {showCalibrationLead && <span className="world-hint__lead">Start with Harmonic Calibration: select a blueprint to inspect its clue, then file it in the Harmonic Calibration Folio.</span>}
            <span className="world-hint__controls">
              Drag objects to a cabinet or workbench ·{' '}
              <span className="world-hint__mouse-guidance">drag empty space to pan · wheel to zoom</span>
              <span className="world-hint__touch-guidance">drag empty space to pan · pinch to zoom</span>
            </span>
          </>}</p>
        <div className="lab-toast" aria-live="polite" role="status" data-testid="game-feedback">{toastText}</div>
        <div className="game-toolbar" role="group" aria-label="World navigation controls">
          <button className="hud-control" type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(0.84)}>−</button>
          <span className="zoom-readout">{Math.round(cullingCamera.scale * 100)}%</span>
          <button className="hud-control" type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.18)}>+</button>
          <label className="sr-only" htmlFor="world-jump">Jump to laboratory location</label>
          <select className="hud-control world-jump" id="world-jump" data-testid="world-jump" defaultValue="start" onChange={(event) => jumpTo(event.target.value)}>
            <option value="start">Starting area</option>
            <option value="engine">Palimpsest Engine</option>
            {destinations.map((destination) => <option key={destination.id} value={`destination:${destination.id}`}>{destination.label}</option>)}
            {scratchPads.map((pad) => <option key={pad.id} value={`scratchpad:${pad.id}`}>{pad.label}</option>)}
            {unfinishedCollectionNavigation.options.length > 0 && (
              <optgroup label="Unfinished collections">
                {unfinishedCollectionNavigation.options.map((collection) => (
                  <option key={collection.id} value={`collection:${collection.id}`}>
                    {collection.label} · {collection.correctCount}/{collection.total}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button className="hud-control" type="button" onClick={focusStartingView}>Reset view</button>
          <button ref={findButtonRef} className="hud-control" type="button" aria-label="Find an item" onClick={toggleFinder}>Find an item</button>
          <button
            ref={selectionToggleButtonRef}
            className="hud-control"
            type="button"
            data-testid="multi-selection-toggle"
            aria-pressed={multiSelectionMode}
            onClick={onToggleSelectionMode}
          >
            {multiSelectionMode ? 'Done selecting items' : 'Select multiple items'}
          </button>
          {(multiSelectionMode || selectedItemIds.length > 0) && <span className="world-count" data-testid="multi-selection-count" aria-live="polite">{selectedItemIds.length} selected</span>}
          <span className="world-count" data-testid="world-item-count" aria-label={`${itemCount} laboratory objects`}>{itemCount} objects</span>
        </div>
      </div>,
      overlayRoot,
    )}
    </>
  );
});
