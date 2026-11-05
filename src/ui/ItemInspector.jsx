import React, { useEffect, useMemo, useRef, useState } from 'react';

const FAMILY_LABELS = Object.freeze({
  'blueprint-fragment': 'Blueprint',
  'handwritten-note': 'Handwritten note',
  gear: 'Clockwork part',
  'experiment-record': 'Experiment record',
  'map-fragment': 'Map fragment',
  'formula-card': 'Formula card',
  'research-record': 'Research record',
});

function itemTypeLabel(item) {
  if (item?.collectionId === 'harmonic-calibration') return 'Resonance tuning plate';
  return FAMILY_LABELS[item?.family] ?? 'Laboratory object';
}

export function ItemInspector({ item, selectedItems = [], collections = [], destinations, scratchPads, focusMoveItemId, onClose, onFocus, onMove }) {
  const collectionLabels = useMemo(() => new Map(collections.map((collection) => [collection.id, collection.label])), [collections]);
  const targets = useMemo(() => [
    { key: 'workspace', kind: 'workspace', id: 'workspace', label: 'Loose in the laboratory' },
    ...scratchPads.map((pad) => ({ key: `scratchpad:${pad.id}`, kind: 'scratchpad', id: pad.id, label: `Scratch pad · ${pad.label}` })),
    ...destinations.map((destination) => ({ key: `destination:${destination.id}`, kind: 'destination', id: destination.id, label: `Final container · ${destination.label}` })),
  ], [destinations, scratchPads]);
  const [targetKey, setTargetKey] = useState('workspace');
  const moveTargetRef = useRef(null);
  const moveButtonRef = useRef(null);
  const selectedIdSignature = selectedItems.map((selectedItem) => selectedItem.id).join('|');
  const isGroupSelection = selectedItems.length > 0;
  const selectedCount = selectedItems.length;
  const sharedCollectionId = isGroupSelection && selectedItems.every((selectedItem) => selectedItem.collectionId === selectedItems[0].collectionId)
    ? selectedItems[0].collectionId
    : null;
  const sharedCollectionLabel = collectionLabels.get(sharedCollectionId);
  const selectedObjectLabel = selectedCount === 1 ? 'object' : 'objects';
  const selectedItemLabel = selectedCount === 1 ? 'item' : 'items';

  const handleEvidenceKeyDown = (event) => {
    const region = event.currentTarget;
    const pageStep = Math.max(1, Math.floor(region.clientHeight * 0.75));
    let nextScrollTop;

    switch (event.key) {
      case 'ArrowDown':
        nextScrollTop = region.scrollTop + 40;
        break;
      case 'ArrowUp':
        nextScrollTop = region.scrollTop - 40;
        break;
      case 'PageDown':
        nextScrollTop = region.scrollTop + pageStep;
        break;
      case ' ':
        nextScrollTop = region.scrollTop + (event.shiftKey ? -pageStep : pageStep);
        break;
      case 'PageUp':
      case 'Home':
        nextScrollTop = event.key === 'Home' ? 0 : region.scrollTop - pageStep;
        break;
      case 'End':
        nextScrollTop = region.scrollHeight;
        break;
      default:
        return;
    }

    event.preventDefault();
    region.scrollTop = nextScrollTop;
  };

  useEffect(() => {
    setTargetKey('workspace');
    if (item?.id !== focusMoveItemId) return undefined;

    const frame = window.requestAnimationFrame(() => moveTargetRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [focusMoveItemId, item?.id, selectedIdSignature]);

  const handleMoveSubmit = (event) => {
    event.preventDefault();
    onMove(isGroupSelection ? selectedItems : item, currentTarget);
    window.requestAnimationFrame(() => moveButtonRef.current?.focus());
  };

  if (!item) {
    return (
      <aside className="panel item-inspector item-inspector--empty" aria-label="Selected item details">
        <p className="eyebrow">Object inspector</p>
        <h2>Select a specimen</h2>
        <p>Choose a paper, instrument, or component in the laboratory to inspect its clues and move it to a work surface or final container.</p>
      </aside>
    );
  }

  const currentTarget = targets.find((target) => (target.kind === 'workspace' ? target.key : target.id) === targetKey) ?? targets[0];
  const isInvalid = item.validation === 'invalid';

  return (
    <aside className="panel item-inspector" aria-label="Selected item details" data-testid="item-inspector">
      <header className="panel-heading">
        <div><p className="eyebrow">Object inspector</p><h2 aria-label={isGroupSelection ? `${selectedCount} ${selectedObjectLabel} selected` : undefined}>{isGroupSelection ? `${selectedCount} selected` : item.title ?? 'Uncatalogued object'}</h2></div>
        <button type="button" className="panel-close" aria-label="Close item inspector" onClick={onClose}>×</button>
      </header>
      {isGroupSelection ? (
        <div
          className="item-inspector__details"
          data-testid="selected-items-summary"
          role="region"
          aria-label="Selected objects and evidence"
          tabIndex={0}
          onKeyDown={handleEvidenceKeyDown}
        >
          <p>{selectedCount} {selectedObjectLabel} {selectedCount === 1 ? 'is' : 'are'} selected. Each object will be checked against the destination separately.</p>
          {sharedCollectionLabel && <p className="selected-items-series"><strong>Series:</strong> {sharedCollectionLabel}</p>}
          <ul className="selected-item-list">
            {selectedItems.map((selectedItem) => (
              <li key={selectedItem.id}>
                <strong>{selectedItem.title ?? 'Uncatalogued object'}</strong>
                <dl className="selected-item-evidence">
                  <div>
                    <dt>Family</dt>
                    <dd className="selected-item-family">{itemTypeLabel(selectedItem)}</dd>
                  </div>
                  {!sharedCollectionLabel && collectionLabels.has(selectedItem.collectionId) && (
                    <div>
                      <dt>Series</dt>
                      <dd className="selected-item-series">{collectionLabels.get(selectedItem.collectionId)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Clue</dt>
                    <dd className="selected-item-clue">{selectedItem.clue ?? 'No notes have been recorded for this object yet.'}</dd>
                  </div>
                </dl>
                {selectedItem.validation === 'invalid' && <span className="misfiled-message">Misfiled</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : <div className="item-inspector__details">
        <div className="inspector-art" aria-hidden="true"><span>{item.mark ?? '✧'}</span></div>
        <p className="item-family">{itemTypeLabel(item)}</p>
        {collectionLabels.has(item.collectionId) && <p className="item-series" data-testid="item-series"><strong>Series:</strong> {collectionLabels.get(item.collectionId)}</p>}
        <p className="item-clue">“{item.clue ?? 'No notes have been recorded for this object yet.'}”</p>
        {isInvalid && <p className="misfiled-message" role="status">⚠ Misfiled — this object is still here. Move it somewhere else to correct the record.</p>}
        {item.validation === 'correct' && <p className="correct-message" role="status">✓ Correctly catalogued.</p>}

        <div className="inspector-meta">
          <span>Current home</span>
          <strong>{item.placement?.kind === 'destination' ? (destinations.find((entry) => entry.id === (item.placement.destinationId ?? item.placement.id))?.label ?? 'Final container') : item.placement?.kind === 'scratchpad' ? (scratchPads.find((entry) => entry.id === (item.placement.scratchPadId ?? item.placement.id))?.label ?? 'Scratch pad') : 'Loose in the laboratory'}</strong>
        </div>

      </div>}
      <div className="item-inspector__actions">
        <form className="move-item-form" onSubmit={handleMoveSubmit}>
          <label htmlFor="move-target">{isGroupSelection
            ? 'Move selected objects to'
            : 'Move to destination or work surface'}</label>
          <select ref={moveTargetRef} id="move-target" data-testid="move-target" value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
            {targets.map((target) => <option key={target.key} value={target.kind === 'workspace' ? target.key : target.id}>{target.label}</option>)}
          </select>
          <button
            ref={moveButtonRef}
            type="submit"
            className="primary-control"
            data-testid={isGroupSelection ? 'move-selected-items' : 'move-item'}
            aria-label={isGroupSelection ? `Move ${selectedCount} selected ${selectedItemLabel}` : undefined}
          >
            {isGroupSelection ? 'Move' : 'Move item'}
          </button>
        </form>
        {!isGroupSelection && <button type="button" className="text-control" onClick={() => onFocus(item)}>Focus this object in the lab</button>}
      </div>
    </aside>
  );
}
