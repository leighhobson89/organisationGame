import React from 'react';

export function InventionCore({ stage, completedCollections, solvedPuzzles, cameraScale = 1 }) {
  const powered = solvedPuzzles > 0;
  const assembled = completedCollections > 0;
  const stageLabel = stage ?? (powered ? 'Memory Crystal' : assembled ? 'First assembly' : 'Dormant');
  const stageClass = String(stageLabel).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const chronologyReady = stageLabel === 'Chronology Wheel';
  const memoryCrystalReady = stageLabel === 'Memory Crystal' || chronologyReady;
  const overview = cameraScale <= 0.6;
  const overviewClass = overview ? ' invention-core--overview' : '';
  const synopsis = chronologyReady
    ? 'The chronology wheel can now reconcile the Engine’s recovered impressions.'
    : powered
      ? 'A memory stirs within the brass.'
      : assembled
        ? 'A recovered pattern has awakened the lens.'
        : 'An unfinished instrument, waiting for its lost parts.';

  return (
    <section
      className={`invention-core invention-core--${stageClass}${assembled ? ' is-assembling' : ''}${powered ? ' is-awake' : ''}${overviewClass}`}
      aria-label="The Palimpsest Engine"
      aria-describedby="palimpsest-engine-synopsis"
    >
      <div className="engine-rings" aria-hidden="true">
        <span className="engine-ring engine-ring--outer" />
        <span className="engine-ring engine-ring--inner" />
        {chronologyReady && (
          <span className="engine-wheel" aria-hidden="true">
            <span className="engine-wheel-spokes">
              <span className="engine-wheel-spoke" />
              <span className="engine-wheel-spoke" />
              <span className="engine-wheel-spoke" />
              <span className="engine-wheel-spoke" />
              <span className="engine-wheel-spoke" />
              <span className="engine-wheel-spoke" />
              <span className="engine-wheel-spoke" />
              <span className="engine-wheel-spoke" />
            </span>
          </span>
        )}
        {memoryCrystalReady && <span className="engine-crystal" aria-hidden="true" />}
        <span className="engine-lens">{powered ? '✦' : '◇'}</span>
      </div>
      <div className="engine-label">
        <strong>The Palimpsest Engine</strong>
        <span id="palimpsest-engine-synopsis" className={overview ? 'sr-only' : undefined}>{synopsis}</span>
      </div>
      <span className="engine-stage">{stageLabel}</span>
    </section>
  );
}
