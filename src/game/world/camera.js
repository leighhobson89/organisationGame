function validateCamera(camera) {
  if (!camera || !Number.isFinite(camera.panX) || !Number.isFinite(camera.panY)) {
    throw new TypeError('Camera pan values must be finite numbers.');
  }

  if (!Number.isFinite(camera.scale) || camera.scale <= 0) {
    throw new RangeError('Camera scale must be a positive finite number.');
  }
}

function validatePoint(point, label = 'Point') {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${label} coordinates must be finite numbers.`);
  }
}

export function worldToScreen(point, camera) {
  validatePoint(point, 'World point');
  validateCamera(camera);

  return {
    x: point.x * camera.scale + camera.panX,
    y: point.y * camera.scale + camera.panY,
  };
}

export function screenToWorld(point, camera) {
  validatePoint(point, 'Screen point');
  validateCamera(camera);

  return {
    x: (point.x - camera.panX) / camera.scale,
    y: (point.y - camera.panY) / camera.scale,
  };
}

/**
 * Set an absolute scale while keeping the world point beneath the pointer fixed.
 * Optional scale bounds are useful for mouse-wheel and toolbar controls.
 */
export function zoomAtPointer(camera, pointer, nextScale, options = {}) {
  validatePoint(pointer, 'Pointer');
  validateCamera(camera);

  if (!Number.isFinite(nextScale) || nextScale <= 0) {
    throw new RangeError('The requested zoom scale must be a positive finite number.');
  }

  const minScale = options.minScale ?? 0.2;
  const maxScale = options.maxScale ?? 2.5;
  if (!Number.isFinite(minScale) || !Number.isFinite(maxScale) || minScale <= 0 || maxScale < minScale) {
    throw new RangeError('Zoom scale bounds must be finite, positive, and ordered.');
  }

  const scale = Math.min(maxScale, Math.max(minScale, nextScale));
  const anchoredWorldPoint = screenToWorld(pointer, camera);

  return {
    panX: pointer.x - anchoredWorldPoint.x * scale,
    panY: pointer.y - anchoredWorldPoint.y * scale,
    scale,
  };
}

/**
 * Scale around the starting pinch midpoint and move that world point to the
 * current midpoint. Optional bounds match the mouse and toolbar zoom limits.
 */
export function zoomAtPinch(camera, start, current, options = {}) {
  validatePoint(start?.midpoint, 'Starting pinch midpoint');
  validatePoint(current?.midpoint, 'Current pinch midpoint');
  validateCamera(camera);

  if (!Number.isFinite(start?.distance) || start.distance <= 0) {
    throw new RangeError('Starting pinch distance must be a positive finite number.');
  }

  if (!Number.isFinite(current?.distance) || current.distance <= 0) {
    throw new RangeError('Current pinch distance must be a positive finite number.');
  }

  const minScale = options.minScale ?? 0.2;
  const maxScale = options.maxScale ?? 2.5;
  if (!Number.isFinite(minScale) || !Number.isFinite(maxScale) || minScale <= 0 || maxScale < minScale) {
    throw new RangeError('Zoom scale bounds must be finite, positive, and ordered.');
  }

  const requestedScale = (camera.scale * current.distance) / start.distance;
  const scale = Math.min(maxScale, Math.max(minScale, requestedScale));
  const anchoredWorldPoint = screenToWorld(start.midpoint, camera);

  return {
    panX: current.midpoint.x - anchoredWorldPoint.x * scale,
    panY: current.midpoint.y - anchoredWorldPoint.y * scale,
    scale,
  };
}
