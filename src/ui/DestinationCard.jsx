import React from 'react';

export function DestinationCard({ destination, collection, placedCount, complete, guided = false, guidedItemTitle, onFocus }) {
  const family = destination.family ?? 'archive';
  const familyClass = String(family).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const slots = destination.slotCount ?? destination.slots ?? 0;
  const contentsLabel = destination.contentsLabel ?? 'Laboratory records';
  const collectionLabel = collection?.label ? `Collection: ${collection.label}.` : null;
  const description = [
    `Final container for ${contentsLabel.toLowerCase()}. ${placedCount} of ${slots || 'many'} objects placed`,
    collectionLabel,
    'Slots auto-fill; items may be filed in any order',
    complete ? 'Collection complete' : null,
    guided ? `Aether Wayfinder marks this destination for ${guidedItemTitle || 'the selected item'}` : null,
  ].filter(Boolean).join('. ');
  const guideAnnouncement = guided
    ? `Aether Wayfinder marks ${guidedItemTitle || 'the selected item'} for ${destination.label}.`
    : undefined;

  return (
    <section
      className={`destination-card destination-card--${familyClass}${complete ? ' is-complete' : ''}${guided ? ' is-guided' : ''}`}
      style={{
        left: destination.position?.x ?? 0,
        top: destination.position?.y ?? 0,
        width: destination.width ?? 250,
        height: destination.height ?? 170,
      }}
      data-testid={`destination-${destination.id}`}
      data-family={familyClass}
      data-drop-kind="destination"
      data-drop-id={destination.id}
      role="region"
      aria-roledescription="final drop destination"
      aria-label={`${destination.label}. ${description}.`}
    >
      {guided && (
        <div className="destination-guide-marker" role="status" aria-live="polite" aria-atomic="true" aria-label={guideAnnouncement} data-testid="aether-wayfinder-marker">
          <span aria-hidden="true">⌖</span>
          <span>For this item · {destination.label}</span>
        </div>
      )}
      <div className="destination-plate">
        <span className="destination-symbol" aria-hidden="true">▤</span>
        <div>
          <h3>{destination.label}</h3>
          <p>{contentsLabel} · {placedCount}{slots ? ` / ${slots}` : ''}</p>
          {collection?.label && <p className="destination-collection-label">Collection: {collection.label}</p>}
          <p className="destination-filing-rule">Auto-fill slots; any order is fine.</p>
        </div>
        {complete && <span className="destination-complete" aria-label="Collection restored">✓ Restored</span>}
      </div>
      <button type="button" className="destination-focus" aria-label={`Focus ${destination.label}`} onClick={() => onFocus(destination)}>
        Focus
      </button>
    </section>
  );
}
