import { expect, test } from '@playwright/test';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';

async function openSettings(page) {
  await page.getByTestId('open-settings').click();
  return page.getByRole('dialog', { name: 'Settings' });
}

async function installAudioHarness(page, { soundEffectsEnabled = false, unsupported = false } = {}) {
  await page.addInitScript(({ key, value, unsupportedAudio }) => {
    window.localStorage.setItem(key, value);
    window.__previewOscillatorStarts = 0;
    window.__previewOscillatorStops = 0;
    window.__previewAudioContextConstructions = 0;
    window.__previewAudioContextResumes = 0;

    if (unsupportedAudio) {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
      return;
    }

    const createParam = () => ({
      value: 0,
      setValueAtTime(nextValue) { this.value = nextValue; },
      linearRampToValueAtTime(nextValue) { this.value = nextValue; },
    });

    window.AudioContext = class FakePreviewAudioContext {
      constructor() {
        window.__previewAudioContextConstructions += 1;
        this.currentTime = 0;
        this.destination = {};
        this.state = 'suspended';
      }

      async resume() {
        this.state = 'running';
        window.__previewAudioContextResumes += 1;
      }
      async close() { this.state = 'closed'; }
      createOscillator() {
        return {
          frequency: createParam(),
          connect() {},
          disconnect() {},
          start() { window.__previewOscillatorStarts += 1; },
          stop() { window.__previewOscillatorStops += 1; },
        };
      }
      createGain() {
        return { gain: createParam(), connect() {}, disconnect() {} };
      }
    };
  }, {
    key: PREFERENCES_STORAGE_KEY,
    value: JSON.stringify({ version: 1, textScale: 1, reduceMotion: false, soundEffectsEnabled }),
    unsupportedAudio: unsupported,
  });
}

test('Sound effects can be enabled and disabled persistently without changing accessibility preferences', async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value);
  }, {
    key: PREFERENCES_STORAGE_KEY,
    value: JSON.stringify({ version: 1, textScale: 1.125, reduceMotion: true, soundEffectsEnabled: false }),
  });
  await page.goto('/');

  let settings = await openSettings(page);
  const soundEffects = settings.getByRole('checkbox', { name: 'Sound effects', exact: true });
  await expect(soundEffects).not.toBeChecked();
  await soundEffects.check();

  const enabledPreferences = JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), PREFERENCES_STORAGE_KEY));
  expect(enabledPreferences).toEqual({ version: 1, textScale: 1.125, reduceMotion: true, soundEffectsEnabled: true });
  await settings.getByRole('button', { name: 'Done', exact: true }).click();

  await page.reload();
  settings = await openSettings(page);
  const persistedSoundEffects = settings.getByRole('checkbox', { name: 'Sound effects', exact: true });
  await expect(persistedSoundEffects).toBeChecked();
  await persistedSoundEffects.uncheck();
  const disabledPreferences = JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), PREFERENCES_STORAGE_KEY));
  expect(disabledPreferences).toEqual({ version: 1, textScale: 1.125, reduceMotion: true, soundEffectsEnabled: false });
  await settings.getByRole('button', { name: 'Done', exact: true }).click();

  await page.reload();
  settings = await openSettings(page);
  await expect(settings.getByRole('checkbox', { name: 'Sound effects', exact: true })).not.toBeChecked();
});

test('Settings previews sound only after opt-in without changing gameplay or the game save', async ({ page }) => {
  await installAudioHarness(page);
  await page.goto('/');
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBeTruthy();
  const savedGameBefore = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const skillProgressBefore = await page.getByTestId('skill-points').textContent();
  const chapterProgressBefore = await page.getByTestId('chapter-progress').textContent();

  const settings = await openSettings(page);
  const soundEffects = settings.getByRole('checkbox', { name: 'Sound effects', exact: true });
  const preview = settings.getByRole('button', { name: 'Preview sound', exact: true });
  const previewStatus = settings.getByRole('status', { name: 'Audio preview status' });
  await expect(soundEffects).not.toBeChecked();
  await expect(preview).toBeDisabled();

  await soundEffects.check();
  await expect(preview).toBeEnabled();
  await preview.click();
  await expect(previewStatus).toHaveText('Preview played');
  await expect.poll(() => page.evaluate(() => window.__previewOscillatorStarts)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__previewAudioContextConstructions)).toBe(1);

  const stopsBeforeMute = await page.evaluate(() => window.__previewOscillatorStops);
  await soundEffects.uncheck();
  await expect(preview).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.__previewOscillatorStops)).toBeGreaterThan(stopsBeforeMute);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBe(savedGameBefore);
  await expect(page.getByTestId('skill-points')).toHaveText(skillProgressBefore);
  await expect(page.getByTestId('chapter-progress')).toHaveText(chapterProgressBefore);
});

test('Settings announces when a requested sound preview cannot be played', async ({ page }) => {
  await installAudioHarness(page, { unsupported: true });
  await page.goto('/');

  const settings = await openSettings(page);
  const soundEffects = settings.getByRole('checkbox', { name: 'Sound effects', exact: true });
  const preview = settings.getByRole('button', { name: 'Preview sound', exact: true });
  await soundEffects.check();
  await expect(preview).toBeEnabled();
  await preview.click();

  await expect(settings.getByRole('status', { name: 'Audio preview status' })).toHaveText('Preview could not be played');
  expect(await page.evaluate(() => window.__previewAudioContextConstructions)).toBe(0);
  expect(await page.evaluate(() => window.__previewOscillatorStarts)).toBe(0);
});

test('a gameplay event produces Web Audio activity after a user gesture when effects are enabled', async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
    window.__audioOscillatorStarts = 0;
    window.__audioOscillatorStops = [];
    window.__audioOscillators = [];
    window.__audioContextConstructions = 0;
    window.__audioContextResumes = 0;

    const createParam = (value = 0) => ({
      value,
      setValueAtTime(nextValue) { this.value = nextValue; },
      linearRampToValueAtTime(nextValue) { this.value = nextValue; },
      exponentialRampToValueAtTime(nextValue) { this.value = nextValue; },
      cancelScheduledValues() {},
    });

    window.AudioContext = class FakeAudioContext {
      constructor() {
        window.__audioContextConstructions += 1;
        this.currentTime = 0;
        this.destination = {};
        this.state = 'suspended';
        window.__fakeAudioContext = this;
      }

      async resume() {
        this.state = 'running';
        window.__audioContextResumes += 1;
      }

      async close() { this.state = 'closed'; }

      createOscillator() {
        const oscillator = {
          type: 'sine',
          frequency: createParam(440),
          active: false,
          connect() {},
          start() {
            this.active = true;
            window.__audioOscillatorStarts += 1;
          },
          stop(time) {
            window.__audioOscillatorStops.push(time);
            if (time === undefined || time <= this.context.currentTime) this.active = false;
          },
        };
        oscillator.context = this;
        window.__audioOscillators.push(oscillator);
        return oscillator;
      }

      createGain() {
        return { gain: createParam(0), connect() {} };
      }
    };
  }, {
    key: PREFERENCES_STORAGE_KEY,
    value: JSON.stringify({ version: 1, textScale: 1, reduceMotion: false, soundEffectsEnabled: true }),
  });

  await page.goto('/');
  expect(await page.evaluate(() => window.__audioContextConstructions)).toBe(0, 'audio context creation waits for an enabled user gesture');
  expect(await page.evaluate(() => window.__audioContextResumes)).toBe(0, 'audio remains locked before a user gesture');

  await page.evaluate(() => {
    const target = document.querySelector('[data-testid="open-settings"]');
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
  });
  expect(await page.evaluate(() => window.__audioContextConstructions)).toBe(0, 'an untrusted synthetic pointer event cannot construct a context');
  expect(await page.evaluate(() => window.__audioContextResumes)).toBe(0, 'an untrusted synthetic pointer event cannot unlock audio');

  await page.getByTestId('open-settings').click();
  await expect.poll(() => page.evaluate(() => window.__audioContextConstructions)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__audioContextResumes)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await page.getByTestId('lab-item-calibration-card-01').click();
  await page.getByTestId('move-target').selectOption('cabinet-calibration');
  await page.getByTestId('move-item').click();
  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect.poll(() => page.evaluate(() => window.__audioOscillatorStarts)).toBeGreaterThan(0);

  const startsBeforeMute = await page.evaluate(() => window.__audioOscillatorStarts);
  const stopsBeforeMute = await page.evaluate(() => window.__audioOscillatorStops.length);
  const activeBeforeMute = await page.evaluate(() => window.__audioOscillators.filter((oscillator) => oscillator.active).length);
  expect(activeBeforeMute).toBeGreaterThan(0, 'the first placement cue remains active for the mute check');

  await page.getByTestId('open-settings').click();
  const soundEffects = page.getByRole('checkbox', { name: 'Sound effects', exact: true });
  await expect(soundEffects).toBeChecked();
  await soundEffects.uncheck();
  await expect.poll(() => page.evaluate(() => window.__audioOscillatorStops.length)).toBeGreaterThan(stopsBeforeMute);
  await expect.poll(() => page.evaluate(() => window.__audioOscillators.filter((oscillator) => oscillator.active).length)).toBe(0);
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await page.getByTestId('lab-item-calibration-card-02').click();
  await page.getByTestId('move-target').selectOption('cabinet-calibration');
  await page.getByTestId('move-item').click();
  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /2 of 8 objects placed/i);
  expect(await page.evaluate(() => window.__audioOscillatorStarts)).toBe(startsBeforeMute, 'muted placement events produce no additional Web Audio activity');
});

test('a trusted keyboard gesture unlocks Web Audio before keyboard filing', async ({ page }) => {
  await installAudioHarness(page, { soundEffectsEnabled: true });
  await page.goto('/');

  expect(await page.evaluate(() => window.__previewAudioContextConstructions)).toBe(0);
  expect(await page.evaluate(() => window.__previewAudioContextResumes)).toBe(0);
  expect(await page.evaluate(() => window.__previewOscillatorStarts)).toBe(0);

  const calibrationCard = page.getByTestId('lab-item-calibration-card-01');
  await calibrationCard.focus();
  await expect(calibrationCard).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('item-inspector')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__previewAudioContextConstructions)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__previewAudioContextResumes)).toBe(1);
  expect(await page.evaluate(() => window.__previewOscillatorStarts)).toBe(0, 'selecting a card does not play a placement cue');

  const moveTarget = page.getByTestId('move-target');
  await moveTarget.focus();
  for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowDown');
  await expect(moveTarget).toHaveValue('cabinet-calibration');

  const moveItem = page.getByTestId('move-item');
  await moveItem.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect.poll(() => page.evaluate(() => window.__previewOscillatorStarts)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__previewAudioContextConstructions)).toBe(1);
  expect(await page.evaluate(() => window.__previewAudioContextResumes)).toBe(1);
});
