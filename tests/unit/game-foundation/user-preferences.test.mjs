import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  loadPreferences,
  normalizePreferences,
  savePreferences,
} from '../../../src/game/preferences/preferences.js';

const preferenceDefaults = { textScale: 1, reduceMotion: false, soundEffectsEnabled: false };

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    read(key) { return values.get(key) ?? null; },
  };
}

test('preferences have stable defaults and a separate versioned storage key', () => {
  assert.deepEqual(DEFAULT_PREFERENCES, preferenceDefaults);
  assert.equal(PREFERENCES_STORAGE_KEY, 'palimpsest-laboratory.preferences.v1');
});

test('normalization keeps only supported text scales and a boolean motion preference', () => {
  assert.deepEqual(normalizePreferences({ textScale: 1.125, reduceMotion: true }), {
    textScale: 1.125,
    reduceMotion: true,
    soundEffectsEnabled: false,
  });
  assert.deepEqual(normalizePreferences({ textScale: 1.25, reduceMotion: false, soundEffectsEnabled: true, extra: 'discard me' }), {
    textScale: 1.25,
    reduceMotion: false,
    soundEffectsEnabled: true,
  });
  assert.deepEqual(normalizePreferences({ textScale: 2.125, reduceMotion: 'yes', extra: true }), preferenceDefaults);
  assert.deepEqual(normalizePreferences(null), preferenceDefaults);
  assert.deepEqual(normalizePreferences({ textScale: 1.125, reduceMotion: true, soundEffectsEnabled: 'yes' }), {
    textScale: 1.125,
    reduceMotion: true,
    soundEffectsEnabled: false,
  });
});

test('150% text scale is supported by the existing version 1 preference envelope', () => {
  const storage = createStorage();
  const preference = { textScale: 1.5, reduceMotion: true, soundEffectsEnabled: false };

  assert.deepEqual(normalizePreferences(preference), preference);
  assert.equal(savePreferences(preference, storage), true);
  assert.deepEqual(JSON.parse(storage.read(PREFERENCES_STORAGE_KEY)), {
    version: 1,
    ...preference,
  });
  assert.deepEqual(loadPreferences(storage), preference);
});

for (const textScale of [1.75, 2]) {
  test(`${textScale * 100}% text scale normalizes, saves, and loads in the version 1 preference envelope`, () => {
    const storage = createStorage();
    const preference = { textScale, reduceMotion: true, soundEffectsEnabled: false };

    assert.deepEqual(normalizePreferences({ version: 1, ...preference }), preference);
    assert.equal(savePreferences(preference, storage), true);
    assert.deepEqual(JSON.parse(storage.read(PREFERENCES_STORAGE_KEY)), {
      version: 1,
      ...preference,
    });
    assert.deepEqual(loadPreferences(storage), preference);
  });
}

test('normalization rejects an unknown version when version metadata is present', () => {
  assert.deepEqual(normalizePreferences({ version: 1, textScale: 1.25, reduceMotion: true }), {
    textScale: 1.25,
    reduceMotion: true,
    soundEffectsEnabled: false,
  });
  assert.deepEqual(normalizePreferences({ version: 2, textScale: 1.25, reduceMotion: true }), preferenceDefaults);
});

test('loading missing preferences returns the defaults', () => {
  assert.deepEqual(loadPreferences(createStorage()), preferenceDefaults);
});

test('loading reads a valid version 1 preference envelope', () => {
  const storage = createStorage({
    [PREFERENCES_STORAGE_KEY]: JSON.stringify({ version: 1, textScale: 1.125, reduceMotion: true }),
  });

  assert.deepEqual(loadPreferences(storage), { textScale: 1.125, reduceMotion: true, soundEffectsEnabled: false });
});

test('loading a previous version 1 record keeps accessibility values and defaults the new sound option off', () => {
  const storage = createStorage({
    [PREFERENCES_STORAGE_KEY]: JSON.stringify({ version: 1, textScale: 1.25, reduceMotion: true }),
  });

  assert.deepEqual(loadPreferences(storage), {
    textScale: 1.25,
    reduceMotion: true,
    soundEffectsEnabled: false,
  });
});

test('malformed JSON and unknown versions safely fall back to defaults', () => {
  const malformed = createStorage({ [PREFERENCES_STORAGE_KEY]: '{bad json' });
  const unknownVersion = createStorage({
    [PREFERENCES_STORAGE_KEY]: JSON.stringify({ version: 2, textScale: 1.25, reduceMotion: true }),
  });

  assert.deepEqual(loadPreferences(malformed), preferenceDefaults);
  assert.deepEqual(loadPreferences(unknownVersion), preferenceDefaults);
});

test('storage read exceptions safely fall back to defaults', () => {
  const unavailableStorage = { getItem() { throw new Error('storage blocked'); } };

  assert.doesNotThrow(() => loadPreferences(unavailableStorage));
  assert.deepEqual(loadPreferences(unavailableStorage), preferenceDefaults);
});

test('saving writes only the supported fields in a versioned envelope', () => {
  const storage = createStorage();

  assert.equal(savePreferences({ textScale: 1.25, reduceMotion: true, extra: 'discard me' }, storage), true);
  assert.deepEqual(JSON.parse(storage.read(PREFERENCES_STORAGE_KEY)), {
    version: 1,
    textScale: 1.25,
    reduceMotion: true,
    soundEffectsEnabled: false,
  });
  assert.deepEqual(loadPreferences(storage), { textScale: 1.25, reduceMotion: true, soundEffectsEnabled: false });
});

test('saving persists the opt-in sound effects preference with existing preferences', () => {
  const storage = createStorage();

  assert.equal(savePreferences({ textScale: 1.125, reduceMotion: true, soundEffectsEnabled: true }, storage), true);
  assert.deepEqual(JSON.parse(storage.read(PREFERENCES_STORAGE_KEY)), {
    version: 1,
    textScale: 1.125,
    reduceMotion: true,
    soundEffectsEnabled: true,
  });
  assert.deepEqual(loadPreferences(storage), { textScale: 1.125, reduceMotion: true, soundEffectsEnabled: true });
});

test('storage write exceptions return false without throwing', () => {
  const unavailableStorage = { setItem() { throw new Error('storage blocked'); } };

  assert.doesNotThrow(() => savePreferences(preferenceDefaults, unavailableStorage));
  assert.equal(savePreferences(preferenceDefaults, unavailableStorage), false);
});
