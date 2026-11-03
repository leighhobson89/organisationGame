import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { screenToWorld, worldToScreen, zoomAtPinch, zoomAtPointer } from '../game/world/camera.js';
import { emitGameAudioEvent } from '../game/audio/audioEvents.js';
import { getItemSpatialBounds, hitTestTopmostItem } from '../game/world/hitTest.js';
import { SpatialIndex } from '../game/world/spatialIndex.js';

const CULLING_OVERSCAN = 120;
const CULLING_REFRESH_GUARD = 32;
const DEFAULT_CAMERA = Object.freeze({ panX: 0, panY: 0, scale: 0.8 });

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

function releasePointerCaptures(viewport, pointerIds) {
  pointerIds.forEach((id) => {
    try { viewport?.releasePointerCapture(id); } catch { /* The browser may already have released the pointer. */ }
  });
}

export function useWorldViewportController({
  camera,
  items,
  multiSelectionMode,
  onCameraChange,
  onCameraApplied,
  onCameraPreview,
  onDrop,
  onSelectItem,
  onToggleItemSelection,
  onViewportResize,
  renderModeRef,
  sceneRef,
  viewportRef,
}) {
  const cameraRef = useRef(camera ?? DEFAULT_CAMERA);
  const lastExternalCameraRef = useRef(camera);
  const cullingCameraRef = useRef(cameraRef.current);
  const pendingCameraRef = useRef(null);
  const cameraRafRef = useRef(null);
  const zoomCommitTimerRef = useRef(null);
  const gestureRef = useRef(null);
  const touchPointersRef = useRef(new Map());
  const pinchSequenceRef = useRef(false);
  const spaceDownRef = useRef(false);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const sizeRef = useRef(size);
  const [cullingCamera, setCullingCamera] = useState(cameraRef.current);
  const [cullingRevision, setCullingRevision] = useState(0);
  const [dragPreview, setDragPreview] = useState(null);
  const [pinchActive, setPinchActive] = useState(false);

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

  const applyCamera = useCallback((nextCamera) => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.style.transform = `translate(${nextCamera.panX}px, ${nextCamera.panY}px) scale(${nextCamera.scale})`;
    scene.style.setProperty('--inverse-camera-scale', String(1 / nextCamera.scale));
    onCameraApplied();
  }, [onCameraApplied, sceneRef]);

  const commitCamera = useCallback((nextCamera, { refreshCulling = false } = {}) => {
    if (cameraRafRef.current !== null) {
      cancelAnimationFrame(cameraRafRef.current);
      cameraRafRef.current = null;
    }
    pendingCameraRef.current = null;
    cameraRef.current = nextCamera;
    lastExternalCameraRef.current = nextCamera;
    applyCamera(nextCamera);
    onCameraPreview(nextCamera);
    refreshCullingSnapshot(nextCamera, refreshCulling);
    onCameraChange(nextCamera);
  }, [applyCamera, onCameraChange, onCameraPreview, refreshCullingSnapshot]);

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
    if (gesture.type === 'pinch') setPinchActive(false);
    releasePointerCaptures(viewportRef.current, pointerIds);
  }, [commitCamera, viewportRef]);

  const scheduleCamera = useCallback((nextCamera) => {
    cameraRef.current = nextCamera;
    pendingCameraRef.current = nextCamera;
    if (cameraRafRef.current !== null) return;
    cameraRafRef.current = requestAnimationFrame(() => {
      cameraRafRef.current = null;
      const latest = pendingCameraRef.current;
      pendingCameraRef.current = null;
      if (!latest) return;
      applyCamera(latest);
      onCameraPreview(latest);
      refreshCullingIfNeeded(latest);
    });
  }, [applyCamera, onCameraPreview, refreshCullingIfNeeded]);

  useEffect(() => {
    if (!camera || camera === lastExternalCameraRef.current) return;
    lastExternalCameraRef.current = camera;
    const activeGesture = gestureRef.current;
    if (activeGesture) {
      gestureRef.current = null;
      setDragPreview(null);
      const pointerIds = new Set([...(activeGesture.pointerIds ?? [activeGesture.pointerId]), ...touchPointersRef.current.keys()]);
      releasePointerCaptures(viewportRef.current, pointerIds);
    }
    touchPointersRef.current.clear();
    pinchSequenceRef.current = false;
    setPinchActive(false);
    if (cameraRafRef.current !== null) cancelAnimationFrame(cameraRafRef.current);
    cameraRafRef.current = null;
    pendingCameraRef.current = null;
    if (zoomCommitTimerRef.current !== null) window.clearTimeout(zoomCommitTimerRef.current);
    zoomCommitTimerRef.current = null;
    cameraRef.current = camera;
    applyCamera(camera);
    onCameraPreview(camera);
    refreshCullingSnapshot(camera, true);
  }, [applyCamera, camera, onCameraPreview, refreshCullingSnapshot, viewportRef]);

  useEffect(() => () => {
    if (cameraRafRef.current !== null) cancelAnimationFrame(cameraRafRef.current);
    if (zoomCommitTimerRef.current !== null) window.clearTimeout(zoomCommitTimerRef.current);
    const activeGesture = gestureRef.current;
    const pointerIds = new Set([
      ...(activeGesture?.pointerIds ?? (activeGesture?.pointerId === undefined ? [] : [activeGesture.pointerId])),
      ...touchPointersRef.current.keys(),
    ]);
    releasePointerCaptures(viewportRef.current, pointerIds);
    touchPointersRef.current.clear();
    gestureRef.current = null;
    pinchSequenceRef.current = false;
  }, [viewportRef]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const nextSize = { width: rect.width, height: rect.height };
      const previousSize = sizeRef.current;
      if (nextSize.width === previousSize.width && nextSize.height === previousSize.height) return;
      if (touchPointersRef.current.size > 0 || gestureRef.current?.type === 'pan') cancelGesture();
      sizeRef.current = nextSize;
      setSize(nextSize);
      refreshCullingSnapshot(cameraRef.current, true);
      onViewportResize();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [cancelGesture, onViewportResize, refreshCullingSnapshot, viewportRef]);

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

  const visibleBounds = useMemo(
    () => getViewportWorldBounds(cullingCamera, size, CULLING_OVERSCAN),
    [cullingCamera, size.height, size.width],
  );

  const visibleItems = useMemo(() => {
    const visible = itemIndex.query(visibleBounds).map((entry) => entry.item);
    if (dragPreview && !visible.some((item) => item.id === dragPreview.id)) {
      const dragged = items.find((item) => item.id === dragPreview.id);
      if (dragged) visible.push(dragged);
    }
    return visible;
  }, [dragPreview, itemIndex, items, visibleBounds]);

  const updatePinchCamera = useCallback((gesture) => {
    const [firstId, secondId] = gesture.pointerIds;
    const first = touchPointersRef.current.get(firstId);
    const second = touchPointersRef.current.get(secondId);
    if (!first || !second) return;
    const geometry = getPinchGeometry(first, second);
    scheduleCamera(zoomAtPinch(gesture.startCamera, gesture.startGeometry, geometry));
  }, [scheduleCamera]);

  const onPointerDown = useCallback((event) => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target;
    if (target.closest('.world-atlas-toggle, .world-atlas-panel')) return;
    if (target.closest('.world-item-finder')) return;
    const isAdditionalTouch = event.pointerType === 'touch' && touchPointersRef.current.size > 0;
    if (!isAdditionalTouch && target.closest('.lab-object-title-reveal')) return;
    if (!isAdditionalTouch) {
      const selectedReveals = viewportRef.current?.querySelectorAll(
        '.lab-object.is-selected > .lab-object-title-reveal',
      ) ?? [];
      const targetItemElement = target.closest('[data-item-id]');
      const selectedRevealOwnersAtPoint = Array.from(selectedReveals)
        .filter((reveal) => {
          const rect = reveal.getBoundingClientRect();
          return event.clientX >= rect.left
            && event.clientX <= rect.right
            && event.clientY >= rect.top
            && event.clientY <= rect.bottom;
        })
        .map((reveal) => reveal.parentElement?.closest('[data-item-id]')?.dataset.itemId)
        .filter(Boolean);
      if (selectedRevealOwnersAtPoint.length > 0
        && (!targetItemElement || selectedRevealOwnersAtPoint.includes(targetItemElement.dataset.itemId))) return;
    }
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
      setPinchActive(true);
      return;
    }
    if (isTouch && (pinchSequenceRef.current || activeGesture)) return;
    if (activeGesture) return;

    const itemElement = target.closest('[data-item-id]');
    let item = itemElement ? items.find((entry) => entry.id === itemElement.dataset.itemId) : null;
    const overviewCanvasHit = !item
      && renderModeRef.current === 'overview'
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
  }, [commitCamera, itemIndex, items, multiSelectionMode, onSelectItem, renderModeRef, viewportRef]);

  const onPointerMove = useCallback((event) => {
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
  }, [scheduleCamera, updatePinchCamera, viewportRef]);

  const onPointerUp = useCallback((event) => {
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
      setPinchActive(false);
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
  }, [commitCamera, onDrop, onSelectItem, onToggleItemSelection, updatePinchCamera, viewportRef]);

  const onPointerCancel = useCallback((event) => {
    cancelGesture(event.pointerId);
  }, [cancelGesture]);

  const onLostPointerCapture = useCallback((event) => {
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
  }, [commitCamera, scheduleCamera, viewportRef]);

  const zoomBy = useCallback((factor) => {
    const pointer = { x: size.width / 2, y: size.height / 2 };
    commitCamera(zoomAtPointer(cameraRef.current, pointer, cameraRef.current.scale * factor));
  }, [commitCamera, size.height, size.width]);

  return {
    cameraRef,
    cancelGesture,
    cullingCamera,
    cullingRevision,
    commitCamera,
    dragPreview,
    fitTargetScale,
    focusWorldPoint,
    pinchActive,
    onLostPointerCapture,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    scheduleCamera,
    size,
    visibleBounds,
    visibleItems,
    zoomBy,
  };
}
