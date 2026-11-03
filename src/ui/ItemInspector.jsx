import React, { useEffect, useMemo, useRef, useState } from 'react';

export function ItemInspector({ item, selectedItems = [], destinations, scratchPads, focusMoveItemId, onClose, onFocus, onMove }) {
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
  const selectedObjectLabel = selectedCount === 1 ? 'object' : 'objects';
  const selectedItemLabel = selectedCount === 1 ? 'item' : 'items';

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
        <div><p className="eyebrow">Object inspector</p><h2>{isGroupSelection ? `${selectedCount} ${selectedObjectLabel} selected` : item.title ?? 'Uncatalogued object'}</h2></div>
        <button type="button" className="panel-close" aria-label="Close item inspector" onClick={onClose}>×</button>
      </header>
      {isGroupSelection ? (
        <div className="item-inspector__details" data-testid="selected-items-summary">
          <p>{selectedCount} {selectedObjectLabel} {selectedCount === 1 ? 'is' : 'are'} selected. Each object will be checked against the destination separately.</p>
          <ul className="selected-item-list" aria-label="Selected objects and evidence">
            {selectedItems.map((selectedItem) => (
              <li key={selectedItem.id}>
                <strong>{selectedItem.title ?? 'Uncatalogued object'}</strong>
                <dl className="selected-item-evidence">
                  <div>
                    <dt>Family</dt>
                    <dd className="selected-item-family">{selectedItem.family ?? 'Unknown family'}</dd>
                  </div>
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
        <p className="item-family">{item.family ?? 'Unknown family'}</p>
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
            ? `Move selected ${selectedObjectLabel} to destination or work surface`
            : 'Move to destination or work surface'}</label>
          <select ref={moveTargetRef} id="move-target" data-testid="move-target" value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
            {targets.map((target) => <option key={target.key} value={target.kind === 'workspace' ? target.key : target.id}>{target.label}</option>)}
          </select>
          <button ref={moveButtonRef} type="submit" className="primary-control" data-testid={isGroupSelection ? 'move-selected-items' : 'move-item'}>
            {isGroupSelection ? `Move ${selectedCount} selected ${selectedItemLabel}` : 'Move item'}
          </button>
        </form>
        {!isGroupSelection && <button type="button" className="text-control" onClick={() => onFocus(item)}>Focus this object in the lab</button>}
      </div>
    </aside>
  );
}
