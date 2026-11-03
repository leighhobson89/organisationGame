/**
 * Resolve a drop target without mutating the item or automatically moving it.
 * Final destinations are validated; scratch pads and the workspace are not.
 */
export function validateDrop(item, target) {
  if (!item || typeof item !== 'object' || typeof item.id !== 'string') {
    throw new TypeError('A placement item with an id is required.');
  }

  if (!target || typeof target !== 'object' || typeof target.kind !== 'string') {
    throw new TypeError('A placement target with a kind is required.');
  }

  if (target.kind !== 'destination') {
    return { status: 'unchecked', target };
  }

  if (typeof target.id !== 'string') {
    throw new TypeError('A final destination target requires an id.');
  }

  return {
    status: target.id === item.correctDestinationId ? 'correct' : 'invalid',
    target,
  };
}
