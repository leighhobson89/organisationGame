import { memo } from 'react';

const EMPTY_HIGHLIGHT_SOURCES = Object.freeze([]);

export const LabObject = memo(function LabObject({ item, selected, pressed = selected, highlightSources = EMPTY_HIGHLIGHT_SOURCES, dragging, onSelect }) {
  const invalid = item.validation === 'invalid';
  const rotation = item.placement?.kind === 'workspace' ? item.rotation ?? 0 : 0;
  const family = String(item.family ?? 'artifact').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const highlighted = highlightSources.length > 0;
  const name = [
    item.title ?? 'Uncatalogued object',
    item.family ?? 'artifact',
    item.clue,
    ...highlightSources.map((source) => `Highlighted by the ${source}.`),
    invalid ? 'Misfiled. Move this object to correct its placement.' : null,
  ].filter(Boolean).join('. ');

  return (
    <button
      type="button"
      className={`lab-object lab-object--${family}${selected ? ' is-selected' : ''}${highlighted ? ' is-related' : ''}${dragging ? ' is-dragging' : ''}${invalid ? ' misfiled' : ''}${item.validation === 'correct' ? ' success-pulse' : ''}`}
      style={{
        left: item.position?.x ?? 0,
        top: item.position?.y ?? 0,
        width: item.width ?? 112,
        height: item.height ?? 76,
        minHeight: item.placement?.kind !== 'workspace' ? item.height : undefined,
        transform: `rotate(${rotation}deg)`,
        pointerEvents: dragging ? 'none' : 'auto',
      }}
      data-testid={`lab-item-${item.id}`}
      data-item-id={item.id}
      data-family={family}
      aria-label={name}
      aria-pressed={pressed}
      aria-describedby={invalid ? `misfiled-${item.id}` : undefined}
      title={item.clue ?? item.title}
      onClick={(event) => onSelect(item.id, { keyboard: event.detail === 0 })}
    >
      <span className="lab-object-mark" aria-hidden="true">{item.mark ?? '✧'}</span>
      {highlighted && <span className="lab-object-highlight-marker" aria-hidden="true">✦</span>}
      <span className="lab-object-title">{item.title ?? 'Uncatalogued object'}</span>
      <span className="lab-object-title-reveal" aria-hidden="true">{item.title ?? 'Uncatalogued object'}</span>
      {invalid && <span className="misfiled-badge misfiled-label" id={`misfiled-${item.id}`}>⚠ Misfiled</span>}
    </button>
  );
});
