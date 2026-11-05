import React, { useEffect, useRef } from 'react';

const FAMILY_STYLES = {
  'blueprint-fragment': { fill: '#b8cee0', edge: '#294b66', accent: '#37759d', shape: 'diamond' },
  'handwritten-note': { fill: '#efd8a2', edge: '#66502d', accent: '#bc743b', shape: 'note' },
  gear: { fill: '#c7d0bb', edge: '#3c4d42', accent: '#71865d', shape: 'gear' },
  'experiment-record': { fill: '#d8c3a4', edge: '#59422c', accent: '#a45436', shape: 'record' },
  'research-record': { fill: '#c4d6c5', edge: '#355342', accent: '#57836a', shape: 'record' },
  'map-fragment': { fill: '#dfd2ae', edge: '#554a30', accent: '#b18c42', shape: 'map' },
  'formula-card': { fill: '#d2c5df', edge: '#493a5d', accent: '#755a98', shape: 'formula' },
  artifact: { fill: '#d6c39e', edge: '#54442e', accent: '#9b7540', shape: 'record' },
};

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawCard(context, item) {
  const width = item.width ?? 112;
  const height = item.height ?? 76;
  const x = item.position?.x ?? 0;
  const y = item.position?.y ?? 0;
  const style = FAMILY_STYLES[item.family] ?? FAMILY_STYLES.artifact;
  const rotation = item.placement?.kind === 'workspace' ? (item.rotation ?? 0) : 0;

  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate((rotation * Math.PI) / 180);
  const left = -width / 2;
  const top = -height / 2;
  roundedRect(context, left, top, width, height, 8);
  context.fillStyle = style.fill;
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = style.edge;
  context.stroke();

  context.fillStyle = style.accent;
  context.fillRect(left + 4, top + 4, Math.min(10, width / 5), height - 8);

  if (style.shape === 'diamond') {
    context.beginPath();
    context.moveTo(left + width * 0.68, top + height * 0.2);
    context.lineTo(left + width * 0.82, 0);
    context.lineTo(left + width * 0.68, top + height * 0.2 + height * 0.24);
    context.lineTo(left + width * 0.54, 0);
    context.closePath();
    context.fillStyle = '#e8f3fb';
    context.fill();
    context.strokeStyle = style.edge;
    context.lineWidth = 2;
    context.stroke();
  } else if (style.shape === 'note') {
    context.strokeStyle = style.edge;
    context.lineWidth = 2;
    for (let line = 0; line < 3; line += 1) {
      const lineY = top + height * (0.34 + line * 0.16);
      context.beginPath();
      context.moveTo(left + width * 0.3, lineY);
      context.lineTo(left + width * (0.82 - (line % 2) * 0.1), lineY);
      context.stroke();
    }
  } else if (style.shape === 'gear') {
    context.beginPath();
    context.arc(left + width * 0.68, 0, Math.min(width, height) * 0.2, 0, Math.PI * 2);
    context.fillStyle = '#e7eadf';
    context.fill();
    context.strokeStyle = style.edge;
    context.lineWidth = 3;
    context.stroke();
    context.beginPath();
    context.arc(left + width * 0.68, 0, Math.min(width, height) * 0.07, 0, Math.PI * 2);
    context.fillStyle = style.accent;
    context.fill();
  } else if (style.shape === 'map') {
    context.strokeStyle = style.edge;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(left + width * 0.34, top + height * 0.3);
    context.lineTo(left + width * 0.52, top + height * 0.22);
    context.lineTo(left + width * 0.68, top + height * 0.32);
    context.lineTo(left + width * 0.84, top + height * 0.23);
    context.lineTo(left + width * 0.84, top + height * 0.72);
    context.lineTo(left + width * 0.68, top + height * 0.82);
    context.lineTo(left + width * 0.52, top + height * 0.72);
    context.lineTo(left + width * 0.34, top + height * 0.8);
    context.closePath();
    context.stroke();
  } else if (style.shape === 'formula') {
    context.fillStyle = style.edge;
    context.font = 'bold 18px Georgia, serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('∑', left + width * 0.66, 0);
  } else {
    context.strokeStyle = style.edge;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(left + width * 0.32, top + height * 0.35);
    context.lineTo(left + width * 0.82, top + height * 0.35);
    context.moveTo(left + width * 0.32, top + height * 0.52);
    context.lineTo(left + width * 0.7, top + height * 0.52);
    context.moveTo(left + width * 0.32, top + height * 0.69);
    context.lineTo(left + width * 0.77, top + height * 0.69);
    context.stroke();
  }

  if (item.validation === 'invalid') {
    context.save();
    context.beginPath();
    context.rect(left, top, width, height);
    context.clip();
    context.fillStyle = '#252018';
    context.fillRect(left, top, width, 10);
    context.strokeStyle = '#f4df9a';
    context.lineWidth = 4;
    for (let stripe = left - height; stripe < left + width + height; stripe += 12) {
      context.beginPath();
      context.moveTo(stripe, top + 10);
      context.lineTo(stripe + 12, top - 2);
      context.stroke();
    }
    context.restore();
  }

  context.restore();
}

function drawHighlightMarker(context, item) {
  const width = item.width ?? 112;
  const height = item.height ?? 76;
  const rotation = item.placement?.kind === 'workspace' ? (item.rotation ?? 0) : 0;

  context.save();
  context.translate(
    (item.position?.x ?? 0) + width / 2,
    (item.position?.y ?? 0) + height / 2,
  );
  context.rotate((rotation * Math.PI) / 180);
  const centerX = width / 2 - 18;
  const centerY = -height / 2 + 18;
  context.beginPath();
  context.arc(centerX, centerY, 15, 0, Math.PI * 2);
  context.fillStyle = '#fff';
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = '#171717';
  context.stroke();

  context.beginPath();
  context.moveTo(centerX, centerY - 8);
  context.lineTo(centerX + 2.5, centerY - 2.5);
  context.lineTo(centerX + 8, centerY);
  context.lineTo(centerX + 2.5, centerY + 2.5);
  context.lineTo(centerX, centerY + 8);
  context.lineTo(centerX - 2.5, centerY + 2.5);
  context.lineTo(centerX - 8, centerY);
  context.lineTo(centerX - 2.5, centerY - 2.5);
  context.closePath();
  context.fillStyle = '#171717';
  context.fill();
  context.restore();
}

const EMPTY_HIGHLIGHTED_ITEM_IDS = new Set();

export function WorldOverviewCanvas({ items, width, height, visible, cameraScale, devicePixelRatio, excludedItemIds, highlightedItemIds = EMPTY_HIGHLIGHTED_ITEM_IDS }) {
  const canvasRef = useRef(null);
  const backingScale = Math.round(Math.min(1, Math.max(0.5, cameraScale * devicePixelRatio)) * 8) / 8;
  const backingWidth = visible ? Math.max(1, Math.ceil(width * backingScale)) : 1;
  const backingHeight = visible ? Math.max(1, Math.ceil(height * backingScale)) : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!visible) return;
    context.save();
    context.scale(backingScale, backingScale);
    for (const item of items) {
      if (!excludedItemIds.has(item.id)) drawCard(context, item);
    }
    for (const item of items) {
      if (!excludedItemIds.has(item.id) && highlightedItemIds.has(item.id)) drawHighlightMarker(context, item);
    }
    context.restore();
  }, [backingHeight, backingScale, backingWidth, excludedItemIds, highlightedItemIds, items, visible]);

  return (
    <canvas
      ref={canvasRef}
      className="world-overview-canvas"
      data-testid="world-overview-canvas"
      data-rendered-item-count={items.length}
      width={backingWidth}
      height={backingHeight}
      style={{ position: 'absolute', zIndex: 0, left: 0, top: 0, width, height, pointerEvents: visible ? 'auto' : 'none' }}
      aria-hidden="true"
      hidden={!visible}
    />
  );
}
