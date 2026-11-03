import React, { useMemo, useState } from 'react';

const RESULTS_PER_PAGE = 25;

export function ItemFinder({ items, onSelectItem, onClose }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) => [item.title, item.family, item.clue, item.id]
      .some((value) => String(value ?? '').toLocaleLowerCase().includes(normalizedQuery)));
  }, [items, query]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / RESULTS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const results = filteredItems.slice(safePage * RESULTS_PER_PAGE, (safePage + 1) * RESULTS_PER_PAGE);

  return (
    <section className="world-item-finder" role="search" aria-label="Find a laboratory item">
      <header className="item-finder-heading">
        <h2>Find an item</h2>
        <button type="button" className="panel-close" aria-label="Close item finder" onClick={onClose}>×</button>
      </header>
      <label htmlFor="item-finder-search">Search laboratory items</label>
      <input
        id="item-finder-search"
        type="search"
        role="searchbox"
        aria-label="Search laboratory items"
        value={query}
        autoFocus
        onChange={(event) => {
          setQuery(event.target.value);
          setPage(0);
        }}
        autoComplete="off"
      />
      <p className="item-finder-count" aria-live="polite">{filteredItems.length} matching items</p>
      <ul className="item-finder-results">
        {results.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="item-finder-result"
              data-testid={`item-finder-result-${item.id}`}
              aria-label={`${item.title ?? 'Uncatalogued object'}. ${item.family ?? 'Unknown family'}.`}
              onClick={(event) => onSelectItem(item, { keyboard: event.detail === 0 })}
            >
              <span>{item.title ?? 'Uncatalogued object'}</span>
              <small>{item.family ?? 'Unknown family'}</small>
            </button>
          </li>
        ))}
      </ul>
      <nav className="item-finder-pagination" aria-label="Item search pages">
        <button type="button" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>Previous</button>
        <span data-testid="item-finder-page" aria-live="polite">Page {safePage + 1} of {pageCount}</span>
        <button type="button" aria-label="Next page" disabled={safePage + 1 >= pageCount} onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}>Next</button>
      </nav>
    </section>
  );
}
