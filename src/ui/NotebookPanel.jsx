import React from 'react';
import { isCollectionComplete } from '../game/domain/completion.js';

function collectionStatus(collection, items, progress) {
  const itemIds = collection.itemIds ?? [];
  const placed = itemIds.filter((id) => {
    const item = items.find((entry) => entry.id === id);
    return item?.validation === 'correct'
      && item.placement?.kind === 'destination'
      && (item.placement.destinationId ?? item.placement.id) === collection.destinationId;
  }).length;
  const rewardEarned = (progress.completedCollectionIds ?? []).includes(collection.id);
  const completed = isCollectionComplete(collection, items);
  return { placed, total: itemIds.length, completed, rewardEarned };
}

export function NotebookPanel({ collections, items, progress, discoveries = [], discoveryEntries = [], onFocusCollection }) {
  const restored = items.filter((item) => item.validation === 'correct').length;
  const percent = items.length ? Math.round((restored / items.length) * 100) : 0;
  const entriesById = new Map(discoveryEntries.map((entry) => [entry.id, entry]));
  const visibleDiscoveries = discoveries.map((id) => entriesById.get(id) ?? { id, title: 'Recovered note', text: id });

  return (
    <aside className="panel notebook-panel" aria-label="Professor's notebook" data-testid="notebook-panel">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Field journal · research notes</p>
          <h2>Professor’s Notebook</h2>
        </div>
        <span className="notebook-seal" aria-hidden="true">✶</span>
      </header>

      <section className="progress-card" aria-label="Laboratory progress">
        <div className="progress-heading"><span>Laboratory restored</span><strong>{percent}%</strong></div>
        <progress value={restored} max={Math.max(items.length, 1)} aria-label={`${percent}% of objects correctly filed`} />
        <p>{restored} objects returned to their proper places</p>
      </section>

      <section className="notebook-section">
        <div className="section-heading">
          <h3>Collections</h3>
          <span>{collections.filter((collection) => isCollectionComplete(collection, items)).length} restored</span>
        </div>
        <ul className="collection-list">
          {collections.map((collection) => {
            const status = collectionStatus(collection, items, progress);
            const label = collection.label ?? collection.name ?? collection.id;
            const accessibleStatus = status.completed
              ? 'Complete.'
              : status.rewardEarned
                ? 'Reward earned; refiling needed.'
                : 'Focus its destination.';
            return (
              <li key={collection.id}>
                <button type="button" className={`collection-entry${status.completed ? ' is-complete' : ''}`} data-testid={`collection-${collection.id}`} onClick={() => onFocusCollection(collection)} aria-label={`${label}: ${status.placed} of ${status.total} correctly placed. ${accessibleStatus}`}>
                  <span className="collection-glyph" aria-hidden="true">{status.completed ? '✓' : '⌑'}</span>
                  <span className="collection-copy">
                    <strong>{label}</strong>
                    <small>{status.placed} / {status.total} filed</small>
                    {status.rewardEarned && !status.completed && (
                      <small className="collection-reward-status">Reward earned; refiling needed.</small>
                    )}
                  </span>
                  <span className="collection-meter" aria-hidden="true"><span style={{ width: `${status.total ? (status.placed / status.total) * 100 : 0}%` }} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="notebook-section notebook-clues" aria-label="Recent discoveries">
        <div className="section-heading"><h3>Recent discoveries</h3><span aria-hidden="true">✧</span></div>
        {visibleDiscoveries.length > 0 ? (
          <ol className="discovery-list">
            {visibleDiscoveries.map((entry) => (
              <li className="discovery-entry" key={entry.id}>
                <strong>{entry.title}</strong>
                <p className="discovery-note">{entry.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="discovery-note">The professor’s scattered notes hint that related objects may reveal more when gathered together.</p>
        )}
        <p className="notebook-footnote">Clues are recorded as you restore the laboratory. Unresolved mysteries remain open.</p>
      </section>
    </aside>
  );
}
