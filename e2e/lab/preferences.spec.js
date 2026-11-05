import { expect, test } from '@playwright/test';
import { COLLECTIONS, DESTINATIONS, PUZZLES, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createDefaultProgress, createNewGameState, normalizeGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { allocateTargetPlacement } from '../../src/game/world/placementLayout.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';

async function installFakeAudioContext(page) {
  await page.addInitScript(() => {
    window.__audioPreviewTrace = {
      contextsCreated: 0,
      resumeCalls: 0,
      scheduledOscillators: [],
      scheduledStops: [],
      connections: 0,
    };

    class FakeAudioParam {
      constructor() {
        this.value = 0;
      }

      setValueAtTime(value) {
        this.value = value;
      }

      linearRampToValueAtTime(value) {
        this.value = value;
      }
    }

    class FakeAudioNode {
      connect(destination) {
        window.__audioPreviewTrace.connections += 1;
        return destination;
      }

      disconnect() {}
    }

    class FakeOscillator extends FakeAudioNode {
      constructor() {
        super();
        this.type = 'sine';
        this.frequency = new FakeAudioParam();
        this.onended = null;
      }

      start(time = 0) {
        window.__audioPreviewTrace.scheduledOscillators.push({
          frequency: this.frequency.value,
          type: this.type,
          time,
        });
      }

      stop(time = 0) {
        window.__audioPreviewTrace.scheduledStops.push(time);
      }
    }

    class FakeGain extends FakeAudioNode {
      constructor() {
        super();
        this.gain = new FakeAudioParam();
      }
    }

    class FakeAudioContext {
      constructor() {
        window.__audioPreviewTrace.contextsCreated += 1;
        this.currentTime = 0;
        this.destination = {};
        this.state = 'suspended';
      }

      createOscillator() {
        return new FakeOscillator();
      }

      createGain() {
        return new FakeGain();
      }

      resume() {
        window.__audioPreviewTrace.resumeCalls += 1;
        this.state = 'running';
        return Promise.resolve();
      }

      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    }

    window.AudioContext = FakeAudioContext;
  });
}

function createAlmostCompleteFixture() {
  const fresh = createNewGameState();
  const finalItem = fresh.items.find((item) => !item.collectionId);
  const placedItems = [];

  for (const item of fresh.items) {
    if (item.id === finalItem.id) continue;
    const allocation = allocateTargetPlacement({
      target: { kind: 'destination', id: item.correctDestinationId },
      item,
      items: placedItems,
      destinations: DESTINATIONS,
      scratchPads: SCRATCH_PADS,
    });
    if (!allocation.ok) throw new Error(`Could not prepare ${item.id}: ${allocation.reason}`);
    placedItems.push({
      ...item,
      position: allocation.position,
      placement: allocation.placement,
      rotation: 0,
      validation: 'correct',
    });
  }

  const placedById = new Map(placedItems.map((item) => [item.id, item]));
  const state = normalizeGameState({
    ...fresh,
    items: fresh.items.map((item) => placedById.get(item.id) ?? item),
    progress: {
      ...createDefaultProgress(),
      skillPoints: 2,
      completedCollectionIds: COLLECTIONS.map((collection) => collection.id),
      unlockedPuzzleIds: PUZZLES.map((puzzle) => puzzle.id),
      solvedPuzzleIds: PUZZLES.map((puzzle) => puzzle.id),
      ownedSkills: ['resonance-lens', 'missing-member-compass'],
    },
    camera: { panX: 0, panY: 0, scale: 0.2 },
    inventionStage: 'Chronology Wheel',
    notebook: {
      discoveries: [
        'memory-impression-01',
        'discovery-bell-before-dawn',
        'discovery-meridian-survey',
        'discovery-parallax-trials',
        'discovery-chronology-last-bell',
      ],
    },
  });

  return { encodedSave: encodeSave(state), finalItem };
}

async function loadAlmostCompleteSave(page, fixture) {
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: fixture.encodedSave,
  });
  await page.goto('/');
}

async function completeLastItem(page, item) {
  await page.getByRole('button', { name: 'Find an item' }).click();
  const search = page.getByRole('searchbox', { name: 'Search laboratory items' });
  await search.fill(item.title);
  const result = page.getByTestId(`item-finder-result-${item.id}`);
  await result.focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('move-target').selectOption(item.correctDestinationId);
  await page.getByTestId('move-item').click();
}

async function expectSettingsControlUsable(dialog, control, description, { withinContent = false } = {}) {
  await expect(control).toBeFocused();
  const geometry = await control.evaluate((element, contentBounded) => {
    const rect = element.getBoundingClientRect();
    const dialog = element.closest('.settings-dialog');
    const dialogRect = dialog.getBoundingClientRect();
    const inViewport = rect.left >= 0 && rect.top >= 0
      && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
    const inDialog = rect.left >= dialogRect.left && rect.right <= dialogRect.right
      && rect.top >= dialogRect.top && rect.bottom <= dialogRect.bottom;
    const content = contentBounded ? element.closest('.settings-dialog__content') : null;
    const contentRect = content?.getBoundingClientRect();
    const inContent = !content || (rect.left >= contentRect.left + content.clientLeft - 1
      && rect.right <= contentRect.left + content.clientLeft + content.clientWidth + 1
      && rect.top >= contentRect.top + content.clientTop - 1
      && rect.bottom <= contentRect.top + content.clientTop + content.clientHeight + 1);
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);

    return {
      inViewport,
      inDialog,
      inContent,
      hitTarget: hit === element || element.contains(hit),
    };
  }, withinContent);

  expect(geometry.inViewport, `${description} should stay fully inside the viewport`).toBe(true);
  expect(geometry.inDialog, `${description} should stay fully inside Settings`).toBe(true);
  if (withinContent) expect(geometry.inContent, `${description} should stay fully inside Settings content`).toBe(true);
  expect(geometry.hitTarget, `${description} should be hit-testable at its center`).toBe(true);
}

for (const [textPercent, textScale] of [[125, '1.25'], [150, '1.5'], [175, '1.75']]) {
  test(`settings persist ${textPercent}% text size separately from game saves and restore focus on Escape`, async ({ page }) => {
    await page.goto('/');

    const settingsButton = page.getByRole('button', { name: 'Settings', exact: true });
    await settingsButton.click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings).toBeVisible();

    const textSize = page.getByLabel('Text size');
    expect(await textSize.locator('option').evaluateAll((options) => options.map((option) => option.value)))
      .toEqual(['1', '1.125', '1.25', '1.5', '1.75', '2']);
    const baselineFontSizes = await page.evaluate(() => ({
      root: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      body: Number.parseFloat(getComputedStyle(document.body).fontSize),
    }));
    await textSize.selectOption(textScale);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim()))
      .toBe(textScale);
    const scaledFontSizes = await page.evaluate(() => ({
      root: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      body: Number.parseFloat(getComputedStyle(document.body).fontSize),
    }));
    expect(scaledFontSizes.root).toBeCloseTo(baselineFontSizes.root * Number(textScale), 1);
    expect(scaledFontSizes.body).toBeCloseTo(baselineFontSizes.body * Number(textScale), 1);
    await page.getByRole('checkbox', { name: 'Always reduce motion' }).check();

    const storedPreferences = await page.evaluate((key) => window.localStorage.getItem(key), PREFERENCES_STORAGE_KEY);
    expect(JSON.parse(storedPreferences)).toEqual({
      version: 1,
      textScale: Number(textScale),
      reduceMotion: true,
      soundEffectsEnabled: false,
    });

    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);
    await expect(settingsButton).toBeFocused();

    await page.reload();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim()))
      .toBe(textScale);
    await settingsButton.click();
    await expect(page.getByLabel('Text size')).toHaveValue(textScale);
    await expect(page.getByRole('checkbox', { name: 'Always reduce motion' })).toBeChecked();
    await page.keyboard.press('Escape');

    await page.getByTestId('open-saves').click();
    const savedGame = decodeSave(await page.getByTestId('save-export-string').inputValue());
    expect(savedGame).not.toHaveProperty('preferences');
    expect(savedGame).not.toHaveProperty('textScale');
    expect(savedGame).not.toHaveProperty('reduceMotion');
    expect(savedGame).not.toHaveProperty('soundEffectsEnabled');
    expect(JSON.stringify(savedGame)).not.toMatch(/textScale|reduceMotion|soundEffectsEnabled/);
  });
}

test('Settings exposes and persists 200% text size after reload in a compact scrollable dialog', async ({ page }) => {
  const viewport = { width: 320, height: 360 };
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Settings' });
  const content = dialog.locator('.settings-dialog__content');
  const textSize = dialog.getByLabel('Text size');
  const soundEffects = dialog.getByRole('checkbox', { name: 'Sound effects' });
  const done = dialog.getByRole('button', { name: 'Done', exact: true });
  const optionValues = await textSize.locator('option').evaluateAll((options) => options.map((option) => option.value));
  expect(optionValues).toContain('1.75');
  expect(optionValues).toContain('2');

  await textSize.selectOption('2');
  await expect(page.locator('html')).toHaveCSS('--text-scale', '2');
  await expect(textSize).toHaveValue('2');
  await expectSettingsControlUsable(dialog, textSize, '200% Text size control', { withinContent: true });

  const contentLayout = await content.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(contentLayout.scrollWidth, '200% Settings content should not overflow horizontally')
    .toBeLessThanOrEqual(contentLayout.clientWidth + 1);
  expect(contentLayout.scrollHeight, '200% Settings should expose lower preferences in its scrollable content')
    .toBeGreaterThan(contentLayout.clientHeight);
  expect(['auto', 'scroll']).toContain(contentLayout.overflowY);

  await soundEffects.scrollIntoViewIfNeeded();
  await soundEffects.focus();
  await expectSettingsControlUsable(dialog, soundEffects, 'Sound effects control at 200%', { withinContent: true });
  await expect.poll(() => content.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(contentLayout.scrollTop);

  expect(JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), PREFERENCES_STORAGE_KEY)))
    .toEqual({ version: 1, textScale: 2, reduceMotion: false, soundEffectsEnabled: false });
  await done.click();
  await expect(dialog).toHaveCount(0);

  await page.reload();
  await expect(page.locator('html')).toHaveCSS('--text-scale', '2');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Text size')).toHaveValue('2');
});

test('Settings recovers Tab focus when focus moves outside the dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  const settings = page.getByRole('dialog', { name: 'Settings' });
  const firstControl = settings.getByRole('button', { name: /close settings/i });
  const lastControl = settings.getByRole('button', { name: 'Done', exact: true });
  const outsideControl = page.getByTestId('open-saves');

  await outsideControl.focus();
  await page.keyboard.press('Tab');
  await expect(firstControl).toBeFocused();

  await outsideControl.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(lastControl).toBeFocused();
});

test('Settings opens with the text-size control visible at 320x360 with 150% text', async ({ page }) => {
  const viewport = { width: 320, height: 360 };
  await page.setViewportSize(viewport);
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: PREFERENCES_STORAGE_KEY,
    value: JSON.stringify({
      version: 1,
      textScale: 1.5,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }),
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Settings' });
  const content = dialog.locator('.settings-dialog__content');
  const textSize = dialog.getByLabel('Text size');
  await expectSettingsControlUsable(dialog, textSize, 'Initial Text size control', { withinContent: true });

  const contentScrollTop = await content.evaluate((element) => element.scrollTop);
  expect(contentScrollTop, 'opening Settings should scroll the first preference into view').toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'the compact page should not overflow horizontally').toBe(true);
});

for (const viewport of [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
]) {
  for (const [textPercent, textScale] of [[125, '1.25'], [150, '1.5']]) {
    test(`Settings controls and close action stay usable at ${textPercent}% text and ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.getByRole('button', { name: 'Settings', exact: true }).click();

      const dialog = page.getByRole('dialog', { name: 'Settings' });
      const textSize = page.getByLabel('Text size');
      const reduceMotion = page.getByRole('checkbox', { name: 'Always reduce motion' });
      const reduceMotionLabel = dialog.locator('label[for="settings-reduce-motion"]');
      const content = dialog.locator('.settings-dialog__content');
      const closeButton = dialog.getByRole('button', { name: /close/i });
      const doneButton = dialog.getByRole('button', { name: 'Done', exact: true });
      await textSize.selectOption(textScale);
      await expect(page.locator('html')).toHaveCSS('--text-scale', textScale);
      await expect(textSize).toBeVisible();
      await expect(closeButton).toBeVisible();
      await expect(doneButton).toBeVisible();

      const pinnedEntries = [
        ['Settings dialog', dialog],
        ['Close button', closeButton],
        ['Done button', doneButton],
      ];
      for (const [name, locator] of pinnedEntries) {
        const box = await locator.boundingBox();
        expect(box, `${name} should have rendered geometry`).not.toBeNull();
        expect(box.x, `${name} should stay inside the left viewport edge`).toBeGreaterThanOrEqual(0);
        expect(box.y, `${name} should stay inside the top viewport edge`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${name} should stay inside the right viewport edge`).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height, `${name} should stay inside the bottom viewport edge`).toBeLessThanOrEqual(viewport.height);
      }

      for (const [name, scrollTarget, focusTarget] of [
        ['Text size control', textSize, textSize],
        ['Reduce motion control', reduceMotionLabel, reduceMotion],
      ]) {
        await scrollTarget.scrollIntoViewIfNeeded();
        await expect(scrollTarget, `${name} should be reachable in the scrollable Settings content`).toBeInViewport({ ratio: 0.99 });
        await focusTarget.focus();
        await expect(focusTarget, `${name} should receive keyboard focus after scrolling`).toBeFocused();
        const [fieldBox, contentBox] = await Promise.all([scrollTarget.boundingBox(), content.boundingBox()]);
        expect(fieldBox, `${name} should have rendered geometry`).not.toBeNull();
        expect(contentBox, 'Settings content should have rendered geometry').not.toBeNull();
        expect(fieldBox.x, `${name} should stay within Settings content horizontally`).toBeGreaterThanOrEqual(contentBox.x - 1);
        expect(fieldBox.x + fieldBox.width, `${name} should stay within Settings content horizontally`).toBeLessThanOrEqual(contentBox.x + contentBox.width + 1);
        expect(fieldBox.y, `${name} should stay within Settings content vertically`).toBeGreaterThanOrEqual(contentBox.y - 1);
        expect(fieldBox.y + fieldBox.height, `${name} should stay within Settings content vertically`).toBeLessThanOrEqual(contentBox.y + contentBox.height + 1);
      }

      const contentOverflow = await content.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(contentOverflow.scrollWidth, 'Settings content should not clip horizontally at the selected text size')
        .toBeLessThanOrEqual(contentOverflow.clientWidth + 1);
      expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual({ x: 0, y: 0 });
      await closeButton.click();
      await expect(dialog).toHaveCount(0);
    });
  }
}

for (const viewport of [
  { width: 320, height: 360 },
  { width: 320, height: 400 },
  { width: 390, height: 400 },
]) {
  test(`150% Settings controls stay keyboard-usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Settings' });
    const content = dialog.locator('.settings-dialog__content');
    const title = dialog.getByRole('heading', { name: 'Settings', exact: true });
    const closeButton = dialog.getByRole('button', { name: /close/i });
    const doneButton = dialog.getByRole('button', { name: 'Done', exact: true });
    const textSize = page.getByLabel('Text size');
    const reduceMotion = page.getByRole('checkbox', { name: 'Always reduce motion' });
    const soundEffects = page.getByRole('checkbox', { name: 'Sound effects' });
    const previewSound = dialog.getByRole('button', { name: 'Preview sound' });

    await textSize.selectOption('1.5');
    await expect(page.locator('html')).toHaveCSS('--text-scale', '1.5');
    await expectSettingsControlUsable(dialog, textSize, 'Text size control after scale change', { withinContent: true });
    await expect(dialog).toBeVisible();
    await expect(closeButton).toBeVisible();
    await expect(doneButton).toBeVisible();

    for (const [name, control] of [
      ['Settings dialog', dialog],
      ['Settings title', title],
      ['Close button', closeButton],
      ['Done button', doneButton],
    ]) {
      const box = await control.boundingBox();
      expect(box, `${name} should have rendered geometry`).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }

    const initialContentScrollTop = await content.evaluate((element) => element.scrollTop);
    await textSize.focus();
    await expectSettingsControlUsable(dialog, textSize, 'Text size control', { withinContent: true });
    await page.keyboard.press('Shift+Tab');
    await expectSettingsControlUsable(dialog, closeButton, 'Close button');
    await page.keyboard.press('Tab');
    await expectSettingsControlUsable(dialog, textSize, 'Text size control', { withinContent: true });
    await page.keyboard.press('Tab');
    await expectSettingsControlUsable(dialog, reduceMotion, 'Reduce motion control', { withinContent: true });
    await page.keyboard.press('Tab');
    await expectSettingsControlUsable(dialog, soundEffects, 'Sound effects control', { withinContent: true });
    await page.keyboard.press('Space');
    await expect(soundEffects).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(previewSound).toBeEnabled();
    await expectSettingsControlUsable(dialog, previewSound, 'Preview sound control', { withinContent: true });
    await page.keyboard.press('Tab');
    await expectSettingsControlUsable(dialog, doneButton, 'Done button');

    const contentLayout = await content.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(contentLayout.scrollWidth, 'Settings content should not overflow horizontally')
      .toBeLessThanOrEqual(contentLayout.clientWidth + 1);
    expect(contentLayout.scrollHeight, 'Settings content should be vertically scrollable when needed')
      .toBeGreaterThan(contentLayout.clientHeight);
    expect(['auto', 'scroll']).toContain(contentLayout.overflowY);
    expect(contentLayout.scrollTop, 'keyboard traversal should scroll Settings content to lower controls')
      .toBeGreaterThan(initialContentScrollTop);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      'page should not overflow horizontally').toBe(true);

    await closeButton.click();
    await expect(dialog).toHaveCount(0);
  });
}

test('Always reduce motion makes the ending reduced when the OS has no motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const fixture = createAlmostCompleteFixture();
  await loadAlmostCompleteSave(page, fixture);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Always reduce motion' }).check();
  await page.keyboard.press('Escape');
  await completeLastItem(page, fixture.finalItem);

  await expect(page.getByTestId('completion-sequence')).toHaveAttribute('data-motion', 'reduced');
});

test('the OS reduced-motion setting is honored when Always reduce motion is off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fixture = createAlmostCompleteFixture();
  await loadAlmostCompleteSave(page, fixture);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Always reduce motion' })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await completeLastItem(page, fixture.finalItem);

  await expect(page.getByTestId('completion-sequence')).toHaveAttribute('data-motion', 'reduced');
});

test('Settings plays the sound preview through the Web Audio adapter', async ({ page }) => {
  await installFakeAudioContext(page);
  await page.goto('/');
  expect(await page.evaluate(() => window.__audioPreviewTrace.contextsCreated)).toBe(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('checkbox', { name: 'Sound effects' }).check();
  const traceAfterEnable = await page.evaluate(() => window.__audioPreviewTrace);
  expect(traceAfterEnable.contextsCreated).toBe(1);
  expect(traceAfterEnable.resumeCalls).toBeGreaterThan(0);
  expect(traceAfterEnable.scheduledOscillators).toHaveLength(0);

  const previewButton = settings.getByRole('button', { name: 'Preview sound' });
  await expect(previewButton).toBeEnabled();
  await previewButton.click();

  await expect(page.getByRole('status', { name: 'Audio preview status' })).toHaveText('Preview played');
  const trace = await page.evaluate(() => window.__audioPreviewTrace);
  expect(trace.contextsCreated).toBe(1);
  expect(trace.resumeCalls).toBeGreaterThan(0);
  expect(trace.scheduledOscillators.map(({ frequency }) => frequency)).toEqual([560, 740]);
  expect(trace.scheduledStops).toHaveLength(2);
  expect(trace.connections).toBeGreaterThanOrEqual(4);
});

test('keyboard can enable sound effects and play the Settings preview', async ({ page }) => {
  await installFakeAudioContext(page);
  await page.goto('/');
  expect(await page.evaluate(() => window.__audioPreviewTrace.contextsCreated)).toBe(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  const settings = page.getByRole('dialog', { name: 'Settings' });
  const soundEffects = settings.getByRole('checkbox', { name: 'Sound effects' });
  await soundEffects.focus();
  await page.keyboard.press('Space');
  await expect(soundEffects).toBeChecked();

  const traceAfterEnable = await page.evaluate(() => window.__audioPreviewTrace);
  expect(traceAfterEnable.contextsCreated).toBe(1);
  expect(traceAfterEnable.resumeCalls).toBeGreaterThan(0);
  expect(traceAfterEnable.scheduledOscillators).toHaveLength(0);

  const previewButton = settings.getByRole('button', { name: 'Preview sound' });
  await previewButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Audio preview status' })).toHaveText('Preview played');

  const trace = await page.evaluate(() => window.__audioPreviewTrace);
  expect(trace.scheduledOscillators.map(({ frequency }) => frequency)).toEqual([560, 740]);
  expect(trace.scheduledStops).toHaveLength(2);
  expect(trace.connections).toBeGreaterThanOrEqual(4);
});

test('a live OS reduced-motion change updates the open ending when the user option is off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const fixture = createAlmostCompleteFixture();
  await loadAlmostCompleteSave(page, fixture);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Always reduce motion' })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await completeLastItem(page, fixture.finalItem);

  const ending = page.getByTestId('completion-sequence');
  await expect(ending).toHaveAttribute('data-motion', 'full');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(ending).toHaveAttribute('data-motion', 'reduced');
});
