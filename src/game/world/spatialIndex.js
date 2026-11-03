function boundsOf(entry) {
  const width = Number.isFinite(entry.width) ? Math.max(0, entry.width) : 0;
  const height = Number.isFinite(entry.height) ? Math.max(0, entry.height) : 0;

  return {
    left: entry.x,
    top: entry.y,
    right: entry.x + width,
    bottom: entry.y + height,
  };
}

function intersects(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export class SpatialIndex {
  constructor(cellSize = 256) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new RangeError('Spatial index cell size must be a positive finite number.');
    }

    this.cellSize = cellSize;
    this.entries = new Map();
    this.cells = new Map();
    this.entryCells = new Map();
    this.entryOrder = new Map();
    this.nextEntryOrder = 0;
  }

  insert(entry) {
    this.#validateEntry(entry);
    if (this.entries.has(entry.id)) this.remove(entry.id);

    const storedEntry = { ...entry };
    this.entries.set(storedEntry.id, storedEntry);
    this.entryOrder.set(storedEntry.id, this.nextEntryOrder);
    this.nextEntryOrder += 1;
    const cellKeys = this.#cellKeysFor(storedEntry);
    this.entryCells.set(storedEntry.id, cellKeys);

    for (const key of cellKeys) {
      if (!this.cells.has(key)) this.cells.set(key, new Set());
      this.cells.get(key).add(storedEntry.id);
    }

    return storedEntry;
  }

  update(entry) {
    return this.insert(entry);
  }

  remove(id) {
    if (!this.entries.has(id)) return false;

    for (const key of this.entryCells.get(id) ?? []) {
      const cell = this.cells.get(key);
      cell?.delete(id);
      if (cell?.size === 0) this.cells.delete(key);
    }

    this.entryCells.delete(id);
    this.entryOrder.delete(id);
    this.entries.delete(id);
    return true;
  }

  query(area) {
    this.#validateArea(area);
    const areaBounds = {
      left: area.x,
      top: area.y,
      right: area.x + area.width,
      bottom: area.y + area.height,
    };
    const candidateIds = new Set();

    for (const key of this.#cellKeysFor(area)) {
      for (const id of this.cells.get(key) ?? []) candidateIds.add(id);
    }

    const results = [];
    for (const id of candidateIds) {
      const entry = this.entries.get(id);
      if (entry && intersects(boundsOf(entry), areaBounds)) results.push(entry);
    }

    results.sort((left, right) => this.entryOrder.get(left.id) - this.entryOrder.get(right.id));

    return results;
  }

  clear() {
    this.entries.clear();
    this.cells.clear();
    this.entryCells.clear();
    this.entryOrder.clear();
    this.nextEntryOrder = 0;
  }

  get size() {
    return this.entries.size;
  }

  #validateEntry(entry) {
    if (!entry || typeof entry.id !== 'string' || entry.id.length === 0) {
      throw new TypeError('Spatial index entries require a non-empty string id.');
    }

    if (!Number.isFinite(entry.x) || !Number.isFinite(entry.y)) {
      throw new TypeError('Spatial index entries require finite x and y coordinates.');
    }
  }

  #validateArea(area) {
    if (!area || !Number.isFinite(area.x) || !Number.isFinite(area.y)
      || !Number.isFinite(area.width) || !Number.isFinite(area.height)
      || area.width < 0 || area.height < 0) {
      throw new TypeError('Spatial query bounds require finite x, y, width, and height values.');
    }
  }

  #cellKeysFor(rectangle) {
    const bounds = rectangle.width === undefined || rectangle.height === undefined
      ? boundsOf(rectangle)
      : {
        left: rectangle.x,
        top: rectangle.y,
        right: rectangle.x + rectangle.width,
        bottom: rectangle.y + rectangle.height,
      };
    const minColumn = Math.floor(bounds.left / this.cellSize);
    const maxColumn = Math.floor(bounds.right / this.cellSize);
    const minRow = Math.floor(bounds.top / this.cellSize);
    const maxRow = Math.floor(bounds.bottom / this.cellSize);
    const keys = [];

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        keys.push(`${column},${row}`);
      }
    }

    return keys;
  }
}
