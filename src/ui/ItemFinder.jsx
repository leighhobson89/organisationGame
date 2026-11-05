import React, { useEffect, useMemo, useRef, useState } from 'react';

const RESULTS_PER_PAGE = 25;

function filterItems(items, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return items;
  return items.filter((item) => [item.title, item.family, item.clue, item.id]
    .some((value) => String(value ?? '').toLocaleLowerCase().includes(normalizedQuery)));
}

function matchingCountMessage(count) {
  return `${count} matching ${count === 1 ? 'item' : 'items'}`;
}

export function ItemFinder({ items, onSelectItem, onClose }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const queryAnnouncementTimerRef = useRef(null);
  const filteredItems = useMemo(() => filterItems(items, query), [items, query]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / RESULTS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const results = filteredItems.slice(safePage * RESULTS_PER_PAGE, (safePage + 1) * RESULTS_PER_PAGE);

  useEffect(() => () => {
    if (queryAnnouncementTimerRef.current !== null) window.clearTimeout(queryAnnouncementTimerRef.current);
  }, []);

  const handleQueryChange = (nextQuery) => {
    setQuery(nextQuery);
    setPage(0);
    if (queryAnnouncementTimerRef.current !== null) window.clearTimeout(queryAnnouncementTimerRef.current);
    queryAnnouncementTimerRef.current = window.setTimeout(() => {
      const count = filterItems(items, nextQuery).length;
      const settledPageCount = Math.max(1, Math.ceil(count / RESULTS_PER_PAGE));
      queryAnnouncementTimerRef.current = null;
      setAnnouncement(`${matchingCountMessage(count)}. Page 1 of ${settledPageCount}.`);
    }, 300);
  };

  const handlePageChange = (nextPage) => {
    const boundedPage = Math.max(0, Math.min(pageCount - 1, nextPage));
    if (boundedPage === safePage) return;
    if (queryAnnouncementTimerRef.current !== null) {
      window.clearTimeout(queryAnnouncementTimerRef.current);
      queryAnnouncementTimerRef.current = null;
    }
    setPage(boundedPage);
    setAnnouncement(`Page ${boundedPage + 1} of ${pageCount}. ${matchingCountMessage(filteredItems.length)}.`);
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <section className="world-item-finder" role="search" aria-label="Find a laboratory item" onKeyDown={handleKeyDown}>
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
        onChange={(event) => handleQueryChange(event.target.value)}
        autoComplete="off"
      />
      <p className="item-finder-count">{filteredItems.length} matching items</p>
      <ul className="item-finder-results">
        {results.map((item) => {
          const invalid = item.validation === 'invalid';
          const title = item.title ?? 'Uncatalogued object';
          const family = item.family ?? 'Unknown family';
          return (
            <li key={item.id}>
              <button
                type="button"
                className="item-finder-result"
                data-testid={`item-finder-result-${item.id}`}
                aria-label={`${title}. ${family}.${invalid ? ' Misfiled. Select this result to inspect it and move it somewhere else to correct the record.' : ''}`}
                onClick={(event) => onSelectItem(item, { keyboard: event.detail === 0 })}
              >
                <span>{title}</span>
                <small>
                  {family}
                  {invalid && <span className="item-finder-misfiled-label">Misfiled</span>}
                </small>
              </button>
            </li>
          );
        })}
      </ul>
      <nav className="item-finder-pagination" aria-label="Item search pages">
        <button type="button" aria-label="Previous page" disabled={safePage === 0} onClick={() => handlePageChange(safePage - 1)}>Previous</button>
        <span data-testid="item-finder-page">Page {safePage + 1} of {pageCount}</span>
        <button type="button" aria-label="Next page" disabled={safePage + 1 >= pageCount} onClick={() => handlePageChange(safePage + 1)}>Next</button>
      </nav>
      <div className="sr-only" role="status" aria-live="polite" data-testid="item-finder-announcer">{announcement}</div>
    </section>
  );
}
