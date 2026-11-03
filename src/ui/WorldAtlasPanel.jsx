import React, { useMemo } from 'react';
import { getAtlasViewportPolygon } from '../game/world/atlasMap.js';

export function WorldAtlasPanel({
  atlasCamera,
  atlasCrosshair,
  atlasDensity,
  atlasLandmarks,
  atlasMapRef,
  atlasProjection,
  atlasStatus,
  bounds,
  closeAtlas,
  grid,
  itemCount,
  onAtlasKeyDown,
  onAtlasPointerCancel,
  onAtlasPointerDown,
  onAtlasPointerMove,
  onAtlasPointerUp,
  onAtlasWheel,
  onLandmarkFocus,
  onLandmarkRecenter,
  onPanelPointerDown,
  onPanelPointerMove,
  size,
  viewBox,
}) {
  const atlasDensityCells = useMemo(() => {
    const maximum = Math.max(1, ...atlasDensity);
    const cellWidth = atlasProjection.mapRect.width / grid.columns;
    const cellHeight = atlasProjection.mapRect.height / grid.rows;
    return atlasDensity.flatMap((count, index) => {
      if (count <= 0) return [];
      const column = index % grid.columns;
      const row = Math.floor(index / grid.columns);
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
  }, [atlasDensity, atlasProjection, grid.columns, grid.rows]);
  const atlasViewportPolygon = useMemo(
    () => getAtlasViewportPolygon(atlasCamera, size, bounds, atlasProjection),
    [atlasCamera, atlasProjection, bounds, size],
  );
  const atlasViewportPoints = atlasViewportPolygon.map((point) => `${point.x},${point.y}`).join(' ');
  const atlasCrosshairPoint = atlasCrosshair ? atlasProjection.projectPoint(atlasCrosshair) : null;

  return (
    <section
      className="world-atlas-panel"
      id="world-atlas-panel"
      data-testid="world-atlas-panel"
      role="region"
      aria-label="Clockwork Atlas"
      onKeyDown={onAtlasKeyDown}
      onPointerDown={onPanelPointerDown}
      onPointerMove={onPanelPointerMove}
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
          viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
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
                style={{ left: `${(point.x / viewBox.width) * 100}%`, top: `${(point.y / viewBox.height) * 100}%` }}
                onFocus={() => onLandmarkFocus(landmark.position)}
                onClick={(event) => {
                  event.stopPropagation();
                  onLandmarkRecenter(landmark.position);
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
  );
}
