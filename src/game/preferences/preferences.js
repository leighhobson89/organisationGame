export const PREFERENCES_STORAGE_KEY = 'palimpsest-laboratory.preferences.v1';

export const DEFAULT_PREFERENCES = Object.freeze({
  textScale: 1,
  reduceMotion: false,
  soundEffectsEnabled: false,
});

const SUPPORTED_TEXT_SCALES = new Set([1, 1.125, 1.25, 1.5]);

function copyDefaults() {
  return { ...DEFAULT_PREFERENCES };
}

function resolveStorage(storage) {
  if (storage !== undefined) return storage;

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function normalizePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return copyDefaults();
  }

  if (Object.prototype.hasOwnProperty.call(value, 'version') && value.version !== 1) {
    return copyDefaults();
  }

  return {
    textScale: SUPPORTED_TEXT_SCALES.has(value.textScale)
      ? value.textScale
      : DEFAULT_PREFERENCES.textScale,
    reduceMotion: typeof value.reduceMotion === 'boolean'
      ? value.reduceMotion
      : DEFAULT_PREFERENCES.reduceMotion,
    soundEffectsEnabled: typeof value.soundEffectsEnabled === 'boolean'
      ? value.soundEffectsEnabled
      : DEFAULT_PREFERENCES.soundEffectsEnabled,
  };
}

function isValidEnvelope(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.version === 1
    && SUPPORTED_TEXT_SCALES.has(value.textScale)
    && typeof value.reduceMotion === 'boolean'
    && (value.soundEffectsEnabled === undefined || typeof value.soundEffectsEnabled === 'boolean')
  );
}

export function loadPreferences(storage) {
  try {
    const source = resolveStorage(storage);
    if (!source || typeof source.getItem !== 'function') return copyDefaults();

    const serialized = source.getItem(PREFERENCES_STORAGE_KEY);
    if (serialized === null || serialized === undefined) return copyDefaults();

    const envelope = JSON.parse(serialized);
    if (!isValidEnvelope(envelope)) return copyDefaults();

    return normalizePreferences(envelope);
  } catch {
    return copyDefaults();
  }
}

export function savePreferences(preferences, storage) {
  try {
    const destination = resolveStorage(storage);
    if (!destination || typeof destination.setItem !== 'function') return false;

    const normalized = normalizePreferences(preferences);
    const envelope = {
      version: 1,
      ...normalized,
    };

    destination.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}
