import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { screenToWorld, worldToScreen, zoomAtPinch, zoomAtPointer } from '../game/world/camera.js';
import { emitGameAudioEvent } from '../game/audio/audioEvents.js';
import { getItemSpatialBounds, hitTestTopmostItem } from '../game/world/hitTest.js';
import { buildAtlasDensity, createWorldAtlasProjection, getAtlasViewportPolygon } from '../game/world/atlasMap.js';
import { getRenderMode } from '../game/world/renderPolicy.js';
import { SpatialIndex } from '../game/world/spatialIndex.js';
import { DestinationCard } from './DestinationCard.jsx';
import { InventionCore } from './InventionCore.jsx';
import { ItemFinder } from './ItemFinder.jsx';
import { LabObject } from './LabObject.jsx';
import { ScratchPad } from './ScratchPad.jsx';
import { WorldOverviewCanvas } from './WorldOverviewCanvas.jsx';

function getPoint(event, element) {
  const rect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function getPinchGeometry(first, second) {
  return {
    midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(0.01, Math.hypot(second.x - first.x, second.y - first.y)),
  };
}

function getTarget(event) {
  const hits = document.elementsFromPoint(event.clientX, event.clientY);
  for (const hit of hits) {
    const zone = hit.closest('[data-drop-kind][data-drop-id]');
    if (zone?.dataset.dropKind && zone.dataset.dropKind !== 'workspace') {
      return { kind: zone.dataset.dropKind, id: zone.dataset.dropId };
    }
  }
  return { kind: 'workspace' };
}

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

const CULLING_OVERSCAN = 120;
const CULLING_REFRESH_GUARD = 32;
const OVERVIEW_OVERLAY_LIMIT = 64;
const TITLE_REVEAL_INSET = 8;
const EMPTY_ITEM_IDS = new Set();
const ATLAS_VIEWBOX = Object.freeze({ width: 520, height: 340 });
const ATLAS_GRID = Object.freeze({ columns: 24, rows: 16 });
const ATLAS_PADDING = 20;

function getViewportWorldBounds(camera, size, overscan) {
  const topLeft = screenToWorld({ x: -overscan, y: -overscan }, camera);
  const bottomRight = screenToWorld({ x: size.width + overscan, y: size.height + overscan }, camera);
  return {
    x: Math.min(topLeft.x, bottomRight.x),
    y: Math.min(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  };
}

function containsBounds(outer, inner) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function sameCamera(left, right) {
  return left?.panX === right?.panX && left?.panY === right?.panY && left?.scale === right?.scale;
}

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

function applySceneCamera(scene, camera) {
  if (!scene) return;
  scene.style.transform = `translate(${camera.panX}px, ${camera.panY}px) scale(${camera.scale})`;
  scene.style.setProperty('--inverse-camera-scale', String(1 / camera.scale));
  positionActiveTitleReveals(scene.parentElement);
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
  keyboardFocusItemId,
  lensActive,
  highlightedItemIds = [],
  guidedDestinationId,
  guidedItemTitle,
  inventionStage,
  progress,
  worldBounds,
}, ref) {
  const viewportRef = useRef(null);
  const sceneRef = useRef(null);
  const findButtonRef = useRef(null);
  const selectionToggleButtonRef = useRef(null);
  const atlasToggleRef = useRef(null);
  const atlasMapRef = useRef(null);
  const gestureRef = useRef(null);
  const touchPointersRef = useRef(new Map());
  const pinchSequenceRef = useRef(false);
  const atlasGestureRef = useRef(null);
  const atlasPointerRafRef = useRef(null);
  const atlasLatestPointerRef = useRef(null);
  const spaceDownRef = useRef(false);
  const cameraRef = useRef(camera ?? { panX: 0, panY: 0, scale: 0.8 });
  const lastExternalCameraRef = useRef(camera);
  const cullingCameraRef = useRef(cameraRef.current);
  const pendingCameraRef = useRef(null);
  const cameraRafRef = useRef(null);
  const titleRevealRafRef = useRef(null);
  const zoomCommitTimerRef = useRef(null);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const sizeRef = useRef(size);
  const [cullingCamera, setCullingCamera] = useState(cameraRef.current);
  const [cullingRevision, setCullingRevision] = useState(0);
  const [dragPreview, setDragPreview] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [atlasCamera, setAtlasCamera] = useState(cameraRef.current);
  const [atlasCrosshair, setAtlasCrosshair] = useState(null);
  const [atlasStatus, setAtlasStatus] = useState('Use arrow keys to move the map crosshair. Press Enter to center.');
  const atlasOpenRef = useRef(false);
  const renderModeRef = useRef('detail');
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

  const refreshCullingSnapshot = useCallback((nextCamera, force = false) => {
    if (!force && sameCamera(cullingCameraRef.current, nextCamera)) return;
    cullingCameraRef.current = nextCamera;
    setCullingCamera(nextCamera);
    setCullingRevision((revision) => revision + 1);
  }, []);

  const refreshCullingIfNeeded = useCallback((nextCamera) => {
    const currentCullingBounds = getViewportWorldBounds(
      cullingCameraRef.current,
      sizeRef.current,
      CULLING_OVERSCAN,
    );
    const guardedViewportBounds = getViewportWorldBounds(
      nextCamera,
      sizeRef.current,
      CULLING_REFRESH_GUARD,
    );
    if (!containsBounds(currentCullingBounds, guardedViewportBounds)) {
      refreshCullingSnapshot(nextCamera);
    }
  }, [refreshCullingSnapshot]);

  const commitCamera = useCallback((nextCamera, { refreshCulling = false } = {}) => {
    if (cameraRafRef.current !== null) {
      cancelAnimationFrame(cameraRafRef.current);
      cameraRafRef.current = null;
    }
    pendingCameraRef.current = null;
    cameraRef.current = nextCamera;
    lastExternalCameraRef.current = nextCamera;
    applySceneCamera(sceneRef.current, nextCamera);
    if (atlasOpenRef.current) setAtlasCamera(nextCamera);
    refreshCullingSnapshot(nextCamera, refreshCulling);
    onCameraChange(nextCamera);
  }, [onCameraChange, refreshCullingSnapshot]);

  const cancelGesture = useCallback((pointerId) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const gesturePointerIds = gesture.pointerIds ?? [gesture.pointerId];
    if (pointerId !== undefined && !gesturePointerIds.includes(pointerId)) return;
    gestureRef.current = null;
    if (gesture.type === 'pan' || gesture.type === 'pinch') commitCamera(gesture.startCamera);
    setDragPreview(null);
    const pointerIds = new Set([...gesturePointerIds, ...touchPointersRef.current.keys()]);
    touchPointersRef.current.clear();
    pinchSequenceRef.current = false;
    pointerIds.forEach((id) => {
      try { viewportRef.current?.releasePointerCapture(id); } catch { /* The browser may already have released the pointer. */ }
    });
  }, [commitCamera]);

  const scheduleCamera = useCallback((nextCamera) => {
    cameraRef.current = nextCamera;
    pendingCameraRef.current = nextCamera;
    if (cameraRafRef.current !== null) return;
    cameraRafRef.current = requestAnimationFrame(() => {
      cameraRafRef.current = null;
      const latest = pendingCameraRef.current;
      pendingCameraRef.current = null;
      if (!latest) return;
      applySceneCamera(sceneRef.current, latest);
      if (atlasOpenRef.current) setAtlasCamera(latest);
      refreshCullingIfNeeded(latest);
    });
  }, [refreshCullingIfNeeded]);

  useEffect(() => {
    if (!camera || camera === lastExternalCameraRef.current) return;
    lastExternalCameraRef.current = camera;
    const activeGesture = gestureRef.current;
    if (activeGesture) {
      gestureRef.current = null;
      setDragPreview(null);
      const pointerIds = new Set([...(activeGesture.pointerIds ?? [activeGesture.pointerId]), ...touchPointersRef.current.keys()]);
      pointerIds.forEach((id) => {
        try { viewportRef.current?.releasePointerCapture(id); } catch { /* The browser may already have released the pointer. */ }
      });
    }
    touchPointersRef.current.clear();
    pinchSequenceRef.current = false;
    if (cameraRafRef.current !== null) cancelAnimationFrame(cameraRafRef.current);
    cameraRafRef.current = null;
    pendingCameraRef.current = null;
    if (zoomCommitTimerRef.current !== null) window.clearTimeout(zoomCommitTimerRef.current);
    zoomCommitTimerRef.current = null;
    cameraRef.current = camera;
    applySceneCamera(sceneRef.current, camera);
    if (atlasOpenRef.current) setAtlasCamera(camera);
    refreshCullingSnapshot(camera, true);
  }, [camera, refreshCullingSnapshot]);

  useEffect(() => () => {
    if (cameraRafRef.current !== null) cancelAnimationFrame(cameraRafRef.current);
    if (titleRevealRafRef.current !== null) cancelAnimationFrame(titleRevealRafRef.current);
    if (zoomCommitTimerRef.current !== null) window.clearTimeout(zoomCommitTimerRef.current);
    const activeGesture = gestureRef.current;
    const pointerIds = new Set([
      ...(activeGesture?.pointerIds ?? (activeGesture?.pointerId === undefined ? [] : [activeGesture.pointerId])),
      ...touchPointersRef.current.keys(),
    ]);
    pointerIds.forEach((id) => {
      try { viewportRef.current?.releasePointerCapture(id); } catch { /* The viewport may already be unmounted. */ }
    });
    touchPointersRef.current.clear();
    gestureRef.current = null;
    pinchSequenceRef.current = false;
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const nextSize = { width: rect.width, height: rect.height };
      const previousSize = sizeRef.current;
      if (nextSize.width === previousSize.width && nextSize.height === previousSize.height) return;
      if (touchPointersRef.current.size > 0) cancelGesture();
      sizeRef.current = nextSize;
      setSize(nextSize);
      refreshCullingSnapshot(cameraRef.current, true);
      positionActiveTitleReveals(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [cancelGesture, refreshCullingSnapshot]);

  useEffect(() => {
    const rootObserver = new MutationObserver(scheduleTitleRevealPosition);
    rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => rootObserver.disconnect();
  }, [scheduleTitleRevealPosition]);

  const itemIndex = useMemo(() => {
    const index = new SpatialIndex(320);
    for (const item of items) {
      const normalizedItem = {
        ...item,
        position: item.position ?? { x: 0, y: 0 },
        width: item.width ?? 100,
        height: item.height ?? 70,
      };
      const spatialBounds = getItemSpatialBounds(normalizedItem);
      index.insert({
        id: item.id,
        ...spatialBounds,
        item,
      });
    }
    return index;
  }, [items]);

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

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space' && event.target?.closest?.('.world-viewport') && !event.target.closest('button, input, textarea, select, .world-atlas-panel')) {
        spaceDownRef.current = true;
        event.preventDefault();
      }
      if (event.key === 'Escape' && gestureRef.current) {
        cancelGesture();
      }
    };
    const onKeyUp = (event) => {
      if (event.code === 'Space') spaceDownRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [cancelGesture]);

  const focusWorldPoint = useCallback((point, scale = cameraRef.current.scale) => {
    const scaledPoint = worldToScreen(point, { panX: 0, panY: 0, scale });
    commitCamera({
      panX: size.width / 2 - scaledPoint.x,
      panY: size.height / 2 - scaledPoint.y,
      scale,
    });
  }, [commitCamera, size.height, size.width]);

  const fitTargetScale = useCallback((target, preferredScale = cameraRef.current.scale) => {
    if (!target?.width || !target?.height) return preferredScale;
    const availableWidth = Math.max(220, size.width - 120);
    const availableHeight = Math.max(180, size.height - 120);
    return Math.min(preferredScale, availableWidth / target.width, availableHeight / target.height);
  }, [size.height, size.width]);

  useImperativeHandle(ref, () => ({
    focusPoint: focusWorldPoint,
    focusSelectionToggle() {
      selectionToggleButtonRef.current?.focus();
    },
    focusItem(item) {
      if (item?.position) focusWorldPoint({ x: item.position.x + (item.width ?? 0) / 2, y: item.position.y + (item.height ?? 0) / 2 });
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
    reset() {
      focusWorldPoint({ x: bounds.x + Math.min(bounds.width * 0.27, 1360), y: bounds.y + Math.min(bounds.height * 0.19, 650) }, 0.5);
    },
  }), [bounds.height, bounds.width, bounds.x, bounds.y, fitTargetScale, focusWorldPoint]);

  const visibleBounds = useMemo(() => {
    return getViewportWorldBounds(cullingCamera, size, CULLING_OVERSCAN);
  }, [cullingCamera, size.height, size.width]);

  const visibleItems = useMemo(() => {
    const visible = itemIndex.query(visibleBounds).map((entry) => entry.item);
    if (dragPreview && !visible.some((item) => item.id === dragPreview.id)) {
      const dragged = items.find((item) => item.id === dragPreview.id);
      if (dragged) visible.push(dragged);
    }
    return visible;
  }, [dragPreview, itemIndex, items, visibleBounds]);
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
  const selectedItem = items.find((item) => item.id === selectedItemId);
  const highlightedItemIdSet = useMemo(() => new Set(highlightedItemIds), [highlightedItemIds]);
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

  const updatePinchCamera = useCallback((gesture) => {
    const [firstId, secondId] = gesture.pointerIds;
    const first = touchPointersRef.current.get(firstId);
    const second = touchPointersRef.current.get(secondId);
    if (!first || !second) return;
    const geometry = getPinchGeometry(first, second);
    const nextCamera = zoomAtPinch(
      gesture.startCamera,
      gesture.startGeometry,
      geometry,
    );
    scheduleCamera(nextCamera);
  }, [scheduleCamera]);

  const onViewportPointerDown = useCallback((event) => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target;
    if (target.closest('.world-atlas-toggle, .world-atlas-panel')) return;
    if (target.closest('.world-item-finder')) return;
    if (target.closest('.lab-object-title-reveal')) return;
    if (target.closest('.game-toolbar, .destination-focus, .scratch-pad button')) return;

    const isTouch = event.pointerType === 'touch';
    const local = getPoint(event, viewportRef.current);
    const activeGesture = gestureRef.current;
    const activeTouches = touchPointersRef.current;

    if (isTouch && activeGesture?.type === 'pinch') return;
    if (isTouch && activeTouches.size > 0) {
      if (pinchSequenceRef.current || !activeGesture || activeGesture.pointerType !== 'touch') return;
      if (!activeTouches.has(activeGesture.pointerId) || activeTouches.has(event.pointerId)) return;

      activeTouches.set(event.pointerId, local);
      try { viewportRef.current?.setPointerCapture(event.pointerId); } catch { /* Capture can fail when the pointer was already released. */ }
      if (activeGesture.type === 'item' || activeGesture.type === 'select') setDragPreview(null);
      if (zoomCommitTimerRef.current !== null) window.clearTimeout(zoomCommitTimerRef.current);
      zoomCommitTimerRef.current = null;

      const pointerIds = [activeGesture.pointerId, event.pointerId];
      const startGeometry = getPinchGeometry(activeTouches.get(pointerIds[0]), activeTouches.get(pointerIds[1]));
      pinchSequenceRef.current = true;
      gestureRef.current = {
        type: 'pinch',
        pointerIds,
        pointerType: 'touch',
        startCamera: cameraRef.current,
        startGeometry,
      };
      return;
    }
    if (isTouch && (pinchSequenceRef.current || activeGesture)) return;
    if (activeGesture) return;

    const itemElement = target.closest('[data-item-id]');
    let item = itemElement ? items.find((entry) => entry.id === itemElement.dataset.itemId) : null;
    const overviewCanvasHit = !item
      && renderMode === 'overview'
      && !target.closest('[data-drop-kind="destination"], [data-drop-kind="scratchpad"], .invention-anchor');
    if (overviewCanvasHit) {
      item = hitTestTopmostItem(itemIndex, screenToWorld(local, cameraRef.current));
    }
    const shouldPan = event.button === 1 || spaceDownRef.current || !item;
    if (item && multiSelectionMode && !shouldPan) {
      if (overviewCanvasHit) {
        gestureRef.current = {
          type: 'select',
          itemId: item.id,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          startLocal: local,
          moved: false,
        };
        if (isTouch) activeTouches.set(event.pointerId, local);
        try { viewportRef.current?.setPointerCapture(event.pointerId); } catch { /* Capture can fail when the pointer was already released. */ }
      }
      return;
    }
    if (shouldPan && zoomCommitTimerRef.current !== null) {
      window.clearTimeout(zoomCommitTimerRef.current);
      zoomCommitTimerRef.current = null;
      commitCamera(cameraRef.current, { refreshCulling: true });
    }
    const interactionCamera = cameraRef.current;
    if (!shouldPan && item) {
      onSelectItem(item.id);
      const pointerWorld = screenToWorld(local, interactionCamera);
      gestureRef.current = {
        type: 'item',
        itemId: item.id,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startLocal: local,
        latestLocal: local,
        originalPosition: item.position ?? { x: 0, y: 0 },
        offset: {
          x: (item.position?.x ?? 0) - pointerWorld.x,
          y: (item.position?.y ?? 0) - pointerWorld.y,
        },
        camera: interactionCamera,
        moved: false,
      };
    } else if (shouldPan && !target.closest('[data-drop-kind="destination"], [data-drop-kind="scratchpad"]')) {
      gestureRef.current = {
        type: 'pan',
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startLocal: local,
        startCamera: interactionCamera,
      };
    } else {
      return;
    }

    if (isTouch) {
      pinchSequenceRef.current = false;
      activeTouches.set(event.pointerId, local);
    }
    if (event.button === 1) event.preventDefault();
    try { viewportRef.current?.setPointerCapture(event.pointerId); } catch { /* Capture can fail when the pointer was already released. */ }
  }, [commitCamera, itemIndex, items, multiSelectionMode, onSelectItem, renderMode]);

  const onViewportPointerMove = useCallback((event) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const local = getPoint(event, viewportRef.current);
    if (gesture.type === 'pinch') {
      if (!gesture.pointerIds.includes(event.pointerId)) return;
      touchPointersRef.current.set(event.pointerId, local);
      updatePinchCamera(gesture);
      return;
    }
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.pointerType === 'touch') touchPointersRef.current.set(event.pointerId, local);
    if (gesture.type === 'pan') {
      scheduleCamera({
        ...gesture.startCamera,
        panX: gesture.startCamera.panX + local.x - gesture.startLocal.x,
        panY: gesture.startCamera.panY + local.y - gesture.startLocal.y,
      });
      return;
    }

    const distance = Math.hypot(local.x - gesture.startLocal.x, local.y - gesture.startLocal.y);
    if (gesture.type === 'select') {
      if (distance >= 4) gesture.moved = true;
      return;
    }
    if (distance < 4 && !gesture.moved) return;
    if (!gesture.moved) emitGameAudioEvent('item.pickup', { itemId: gesture.itemId });
    gesture.moved = true;
    gesture.latestLocal = local;
    const pointerWorld = screenToWorld(local, cameraRef.current ?? gesture.camera);
    setDragPreview({
      id: gesture.itemId,
      position: { x: pointerWorld.x + gesture.offset.x, y: pointerWorld.y + gesture.offset.y },
    });
  }, [scheduleCamera, updatePinchCamera]);

  const onViewportPointerUp = useCallback((event) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const local = getPoint(event, viewportRef.current);
    if (gesture.type === 'pinch') {
      if (!gesture.pointerIds.includes(event.pointerId)) return;
      touchPointersRef.current.set(event.pointerId, local);
      updatePinchCamera(gesture);
      const remainingPointerId = gesture.pointerIds.find((pointerId) => pointerId !== event.pointerId);
      const remainingLocal = touchPointersRef.current.get(remainingPointerId);
      touchPointersRef.current.delete(event.pointerId);
      commitCamera(cameraRef.current, { refreshCulling: true });
      gestureRef.current = {
        type: 'pan',
        pointerId: remainingPointerId,
        pointerType: 'touch',
        startLocal: remainingLocal,
        startCamera: cameraRef.current,
      };
      try { viewportRef.current?.releasePointerCapture(event.pointerId); } catch { /* Pointer capture may already have been released. */ }
      return;
    }
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.pointerType === 'touch') touchPointersRef.current.set(event.pointerId, local);
    gestureRef.current = null;
    if (gesture.type === 'item') {
      if (gesture.moved) {
        const pointerWorld = screenToWorld(local, cameraRef.current);
        const position = { x: pointerWorld.x + gesture.offset.x, y: pointerWorld.y + gesture.offset.y };
        const target = getTarget(event);
        emitGameAudioEvent('item.drop', {
          itemId: gesture.itemId,
          targetKind: target.kind,
          ...(target.id ? { targetId: target.id } : {}),
        });
        onDrop(gesture.itemId, target, position);
      } else {
        onSelectItem(gesture.itemId);
      }
    } else if (gesture.type === 'pan') {
      commitCamera({
        ...gesture.startCamera,
        panX: gesture.startCamera.panX + local.x - gesture.startLocal.x,
        panY: gesture.startCamera.panY + local.y - gesture.startLocal.y,
      }, { refreshCulling: true });
    } else if (gesture.type === 'select' && !gesture.moved) {
      window.setTimeout(() => onToggleItemSelection(gesture.itemId), 0);
    }
    setDragPreview(null);
    touchPointersRef.current.delete(event.pointerId);
    if (touchPointersRef.current.size === 0) pinchSequenceRef.current = false;
    try { viewportRef.current?.releasePointerCapture(event.pointerId); } catch { /* Pointer capture may already have been released. */ }
  }, [commitCamera, onDrop, onSelectItem, onToggleItemSelection, updatePinchCamera]);

  const onViewportPointerCancel = useCallback((event) => {
    cancelGesture(event.pointerId);
  }, [cancelGesture]);

  const onViewportLostPointerCapture = useCallback((event) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const pointerIds = gesture.pointerIds ?? [gesture.pointerId];
    if (pointerIds.includes(event.pointerId)) cancelGesture(event.pointerId);
  }, [cancelGesture]);

  const onWheel = useCallback((event) => {
    if (event.target.closest('.world-atlas-panel')) return;
    if (event.target.closest('.world-item-finder')) return;
    event.preventDefault();
    const point = getPoint(event, viewportRef.current);
    const currentCamera = cameraRef.current;
    const nextScale = currentCamera.scale * (event.deltaY < 0 ? 1.12 : 0.89);
    scheduleCamera(zoomAtPointer(currentCamera, point, nextScale));
    if (zoomCommitTimerRef.current !== null) window.clearTimeout(zoomCommitTimerRef.current);
    zoomCommitTimerRef.current = window.setTimeout(() => {
      zoomCommitTimerRef.current = null;
      commitCamera(cameraRef.current, { refreshCulling: true });
    }, 180);
  }, [commitCamera, scheduleCamera]);

  const zoomBy = useCallback((factor) => {
    const pointer = { x: size.width / 2, y: size.height / 2 };
    commitCamera(zoomAtPointer(cameraRef.current, pointer, cameraRef.current.scale * factor));
  }, [commitCamera, size.height, size.width]);

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
    commitCamera(getCameraCenteredOn(worldPoint, scale, sizeRef.current));
    setAtlasCrosshair(worldPoint);
    setAtlasStatus(getAtlasStatus(worldPoint, atlasLandmarks, scale));
    try { atlasMapRef.current?.releasePointerCapture(event.pointerId); } catch { /* Capture may already have been released. */ }
  }, [atlasLandmarks, atlasProjection, commitCamera]);

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
      scheduleCamera(getCameraCenteredOn(worldPoint, cameraRef.current.scale, sizeRef.current));
    });
  }, [atlasProjection, scheduleCamera]);

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

  const closeAtlas = useCallback(() => {
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
    atlasToggleRef.current?.focus();
  }, [commitCamera]);

  const toggleAtlas = useCallback(() => {
    if (atlasOpenRef.current) {
      closeAtlas();
      return;
    }
    if (finderOpen) setFinderOpen(false);
    atlasOpenRef.current = true;
    setAtlasOpen(true);
    setAtlasCamera(cameraRef.current);
    setAtlasCrosshair({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
  }, [bounds.height, bounds.width, bounds.x, bounds.y, closeAtlas, finderOpen]);

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

  const closeFinder = () => {
    setFinderOpen(false);
    findButtonRef.current?.focus();
  };

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
      focusWorldPoint({ x: bounds.x + Math.min(bounds.width * 0.27, 1360), y: bounds.y + Math.min(bounds.height * 0.19, 650) }, 0.5);
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
      if (destination) focusWorldPoint({ x: destination.position.x + destination.width / 2, y: destination.position.y + destination.height / 2 }, 0.76);
    }
    if (kind === 'scratchpad') {
      const pad = scratchPads.find((entry) => entry.id === id);
      if (pad) focusWorldPoint({ x: pad.position.x + pad.width / 2, y: pad.position.y + pad.height / 2 }, 0.72);
    }
  };

  const atlasDensityCells = useMemo(() => {
    const maximum = Math.max(1, ...atlasDensity);
    const cellWidth = atlasProjection.mapRect.width / ATLAS_GRID.columns;
    const cellHeight = atlasProjection.mapRect.height / ATLAS_GRID.rows;
    return atlasDensity.flatMap((count, index) => {
      if (count <= 0) return [];
      const column = index % ATLAS_GRID.columns;
      const row = Math.floor(index / ATLAS_GRID.columns);
      return [{
        id: index,
        count,
        x: atlasProjection.mapRect.x + column * cellWidth,
        y: atlasProjection.mapRect.y + row * cellHeight,
        width: cellWidth,
        height: cellHeight,
        opacity: 0.18 + (count / maximum) * 0.64,
      }];
    });
  }, [atlasDensity, atlasProjection]);
  const atlasViewportPolygon = useMemo(
    () => getAtlasViewportPolygon(atlasCamera, size, bounds, atlasProjection),
    [atlasCamera, atlasProjection, bounds, size],
  );
  const atlasViewportPoints = atlasViewportPolygon.map((point) => `${point.x},${point.y}`).join(' ');
  const atlasCrosshairPoint = atlasCrosshair ? atlasProjection.projectPoint(atlasCrosshair) : null;

  return (
    <section
      className="world-viewport"
      ref={viewportRef}
      role="region"
      aria-label="Laboratory world. Use the wheel to zoom, drag empty space to pan, or use arrow keys while focused."
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
        />
        {visibleDestinations.map((destination) => {
          const collection = destination.collectionId ? collectionById.get(destination.collectionId) : null;
          const complete = collection && completeIds.includes(collection.id);
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
          const related = highlightedItemIdSet.has(item.id) || Boolean(lensActive && selectedItem && item.id !== selectedItem.id && (
            selectedItem.collectionId
              ? item.collectionId === selectedItem.collectionId
              : item.family === selectedItem.family
          ));
          return (
            <LabObject
              key={item.id}
              item={itemWithPreview}
              selected={selected}
              pressed={pressed}
              highlighted={related}
              dragging={dragPreview?.id === item.id}
              onSelect={multiSelectionMode ? onToggleItemSelection : onSelectItem}
            />
          );
        })}
      </div>
      {finderOpen && <ItemFinder items={items} onSelectItem={selectFinderItem} onClose={closeFinder} />}
      <div className="game-toolbar" aria-label="World navigation controls">
        <button className="hud-control" type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(0.84)}>−</button>
        <span aria-live="polite" className="zoom-readout">{Math.round(cullingCamera.scale * 100)}%</span>
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
        <button className="hud-control" type="button" onClick={() => focusWorldPoint({ x: bounds.x + Math.min(bounds.width * 0.27, 1360), y: bounds.y + Math.min(bounds.height * 0.19, 650) }, 0.5)}>Reset view</button>
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
        <section
          className="world-atlas-panel"
          id="world-atlas-panel"
          data-testid="world-atlas-panel"
          role="region"
          aria-label="Clockwork Atlas"
          onKeyDown={onAtlasKeyDown}
          onPointerDown={(event) => {
            if (event.target.closest?.('.world-atlas-map')) onAtlasPointerDown(event);
            else event.stopPropagation();
          }}
          onPointerMove={(event) => {
            if (event.target.closest?.('.world-atlas-map') || atlasGestureRef.current) onAtlasPointerMove(event);
            else event.stopPropagation();
          }}
          onPointerUp={onAtlasPointerUp}
          onPointerCancel={onAtlasPointerCancel}
          onWheel={onAtlasWheel}
        >
          <header className="world-atlas-header">
            <div className="world-atlas-heading">
              <h2>Clockwork Atlas</h2>
              <p>Item density, laboratory landmarks, and your current view.</p>
            </div>
            <button className="world-atlas-close" type="button" aria-label="Close Clockwork Atlas" onClick={closeAtlas}>Close</button>
          </header>
          <div
            className="world-atlas-map"
            ref={atlasMapRef}
            role="group"
            aria-label="Laboratory map. Use the arrow keys to move the crosshair and Enter to center the view."
            aria-describedby="world-atlas-instructions"
            tabIndex={0}
            onPointerDown={onAtlasPointerDown}
            onPointerMove={onAtlasPointerMove}
            onPointerUp={onAtlasPointerUp}
            onPointerCancel={onAtlasPointerCancel}
            onWheel={onAtlasWheel}
          >
            <svg
              className="world-atlas-art"
              viewBox={`0 0 ${ATLAS_VIEWBOX.width} ${ATLAS_VIEWBOX.height}`}
              aria-hidden="true"
              data-testid="world-atlas-density"
              data-item-count={itemCount}
              data-bin-count={atlasDensity.length}
            >
              <rect
                className="world-atlas-world-area"
                x={atlasProjection.mapRect.x}
                y={atlasProjection.mapRect.y}
                width={atlasProjection.mapRect.width}
                height={atlasProjection.mapRect.height}
              />
              {atlasDensityCells.map((cell) => (
                <rect
                  key={cell.id}
                  className="world-atlas-density-cell"
                  x={cell.x + 1}
                  y={cell.y + 1}
                  width={Math.max(0, cell.width - 2)}
                  height={Math.max(0, cell.height - 2)}
                  opacity={cell.opacity}
                />
              ))}
              <polygon
                className="world-atlas-viewport-outline"
                data-testid="world-atlas-viewport-outline"
                points={atlasViewportPoints}
              />
              {atlasCrosshairPoint && (
                <g className="world-atlas-crosshair">
                  <line x1={atlasCrosshairPoint.x - 7} x2={atlasCrosshairPoint.x + 7} y1={atlasCrosshairPoint.y} y2={atlasCrosshairPoint.y} />
                  <line x1={atlasCrosshairPoint.x} x2={atlasCrosshairPoint.x} y1={atlasCrosshairPoint.y - 7} y2={atlasCrosshairPoint.y + 7} />
                  <circle cx={atlasCrosshairPoint.x} cy={atlasCrosshairPoint.y} r="4" />
                </g>
              )}
            </svg>
            <div className="world-atlas-landmarks" role="group" aria-label="Laboratory landmarks">
              {atlasLandmarks.map((landmark) => {
                const point = atlasProjection.projectPoint(landmark.position);
                return (
                  <button
                    key={`${landmark.kind}:${landmark.id}`}
                    type="button"
                    className={`world-atlas-landmark world-atlas-landmark--${landmark.kind}`}
                    data-testid={`world-atlas-landmark-${landmark.id}`}
                    aria-label={landmark.label}
                    title={landmark.label}
                    style={{ left: `${(point.x / ATLAS_VIEWBOX.width) * 100}%`, top: `${(point.y / ATLAS_VIEWBOX.height) * 100}%` }}
                    onFocus={() => setAtlasCrosshair(landmark.position)}
                    onClick={(event) => {
                      event.stopPropagation();
                      recenterAtlas(landmark.position);
                    }}
                  >
                    <span aria-hidden="true" className="world-atlas-landmark-mark" />
                    <span className="sr-only">{landmark.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="world-atlas-instructions" id="world-atlas-instructions">
            Click or drag the map to center the laboratory view. Use arrow keys to move the crosshair one map cell; press Enter to center on it. Press Escape to close.
          </p>
          <div className="sr-only" role="status" aria-live="polite" data-testid="world-atlas-announcer">{atlasStatus}</div>
        </section>
      )}
      <p className="world-hint">{multiSelectionMode
        ? 'Click or press Enter on objects to select them · use the Inspector to move the group · hold Space and drag to pan'
        : 'Drag objects to a cabinet or workbench · hold Space and drag to pan · wheel to zoom'}</p>
      <div className="sr-only" aria-live="polite" data-testid="world-announcer" />
    </section>
  );
});
