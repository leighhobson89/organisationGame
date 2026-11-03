import { expect, test } from '@playwright/test';
import { observeAudioEvents, readAudioEventTypes } from '../helpers/audioEvents.js';
import { COLLECTIONS, DESTINATIONS, PUZZLES, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createDefaultProgress, createNewGameState, normalizeGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { allocateTargetPlacement } from '../../src/game/world/placementLayout.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const preferencesKey = 'palimpsest-laboratory.preferences.v1';

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

  return { encodedSave: encodeSave(state), finalItem, state };
}

function createFullyFiledState() {
  const almostComplete = createAlmostCompleteFixture();
  const item = almostComplete.state.items.find((entry) => entry.id === almostComplete.finalItem.id);
  const allocation = allocateTargetPlacement({
    target: { kind: 'destination', id: item.correctDestinationId },
    item,
    items: almostComplete.state.items,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });
  if (!allocation.ok) throw new Error(`Could not complete ${item.id}: ${allocation.reason}`);

  return normalizeGameState({
    ...almostComplete.state,
    items: almostComplete.state.items.map((entry) => entry.id === item.id
      ? { ...entry, position: allocation.position, placement: allocation.placement, rotation: 0, validation: 'correct' }
      : entry),
  });
}

async function openEndingFromAlmostCompleteFixture(page) {
  const fixture = createAlmostCompleteFixture();
  await page.addInitScript(({ saveKey, savedPreferencesKey, value }) => {
    window.localStorage.setItem(saveKey, value);
    window.localStorage.setItem(savedPreferencesKey, JSON.stringify({
      version: 1,
      textScale: 1.25,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }));
  }, {
    saveKey: autoSaveKey,
    savedPreferencesKey: preferencesKey,
    value: fixture.encodedSave,
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Find an item' }).click();
  const search = page.getByRole('searchbox', { name: 'Search laboratory items' });
  await search.fill(fixture.finalItem.title);
  await page.getByTestId(`item-finder-result-${fixture.finalItem.id}`).click();
  await page.getByTestId('move-target').selectOption(fixture.finalItem.correctDestinationId);
  await page.getByTestId('move-item').click();

  const ending = page.getByTestId('completion-sequence');
  await expect(ending).toBeVisible();
  return ending;
}

async function expectFullyReachableWithinEndingScrollArea(element) {
  await element.scrollIntoViewIfNeeded();
  const bounds = await element.evaluate((node) => {
    const scrollArea = node.closest('.completion-sequence__dialog');
    const elementRect = node.getBoundingClientRect();
    const scrollRect = scrollArea.getBoundingClientRect();
    const scrollTop = scrollRect.top + scrollArea.clientTop;
    return {
      top: elementRect.top,
      bottom: elementRect.bottom,
      scrollTop,
      scrollBottom: scrollTop + scrollArea.clientHeight,
    };
  });
  expect(bounds.top, 'content should be reachable below the dialog top edge').toBeGreaterThanOrEqual(bounds.scrollTop - 1);
  expect(bounds.bottom, 'content should be reachable above the dialog bottom edge').toBeLessThanOrEqual(bounds.scrollBottom + 1);
}

function createMisfiledItemState() {
  const state = createFullyFiledState();
  const item = state.items.find((entry) => !entry.collectionId);
  const wrongPlacement = DESTINATIONS
    .filter((destination) => destination.id !== item.correctDestinationId)
    .map((destination) => ({
      allocation: allocateTargetPlacement({
        target: { kind: 'destination', id: destination.id },
        item,
        items: state.items,
        destinations: DESTINATIONS,
        scratchPads: SCRATCH_PADS,
      }),
    }))
    .find(({ allocation }) => allocation.ok);
  if (!wrongPlacement) throw new Error(`Could not find an available wrong destination for ${item.id}.`);

  return normalizeGameState({
    ...state,
    items: state.items.map((entry) => entry.id === item.id
      ? {
        ...entry,
        position: wrongPlacement.allocation.position,
        placement: wrongPlacement.allocation.placement,
        rotation: 0,
      }
      : entry),
  });
}

function createIncompleteCollectionState() {
  const state = createFullyFiledState();
  const collection = COLLECTIONS.find((entry) => entry.id === 'harmonic-calibration');
  const item = state.items.find((entry) => entry.id === collection.itemIds[0]);
  const originalItem = createNewGameState().items.find((entry) => entry.id === item.id);
  const allocation = allocateTargetPlacement({
    target: { kind: 'workspace' },
    item,
    items: state.items,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
    preferredPosition: originalItem.position,
  });
  if (!allocation.ok) throw new Error(`Could not unfile ${item.id}: ${allocation.reason}`);

  return normalizeGameState({
    ...state,
    items: state.items.map((entry) => entry.id === item.id
      ? { ...entry, position: allocation.position, placement: allocation.placement, rotation: 0 }
      : entry),
    progress: {
      ...state.progress,
      completedCollectionIds: state.progress.completedCollectionIds.filter((id) => id !== collection.id),
    },
  });
}

function createUnsolvedPuzzleState() {
  const state = createFullyFiledState();
  const unsolvedPuzzleId = PUZZLES[0].id;
  return normalizeGameState({
    ...state,
    progress: {
      ...state.progress,
      solvedPuzzleIds: state.progress.solvedPuzzleIds.filter((id) => id !== unsolvedPuzzleId),
    },
  });
}

const incompleteCompletionScenarios = [
  {
    name: 'a misfiled item even though all puzzles are solved',
    createState: createMisfiledItemState,
    verifyState(state) {
      expect(state.items.some((item) => item.validation === 'invalid')).toBe(true);
      expect(state.progress.solvedPuzzleIds).toEqual(expect.arrayContaining(PUZZLES.map((puzzle) => puzzle.id)));
    },
  },
  {
    name: 'an incomplete collection with all puzzles solved',
    createState: createIncompleteCollectionState,
    verifyState(state) {
      expect(state.items.find((item) => item.id === COLLECTIONS[0].itemIds[0]).placement.kind).toBe('workspace');
      expect(state.progress.completedCollectionIds).not.toContain(COLLECTIONS[0].id);
      expect(state.progress.solvedPuzzleIds).toEqual(expect.arrayContaining(PUZZLES.map((puzzle) => puzzle.id)));
    },
  },
  {
    name: 'an unsolved puzzle despite all objects and collections being complete',
    createState: createUnsolvedPuzzleState,
    verifyState(state) {
      expect(state.items.every((item) => item.validation === 'correct')).toBe(true);
      expect(state.progress.completedCollectionIds).toEqual(expect.arrayContaining(COLLECTIONS.map((collection) => collection.id)));
      expect(state.progress.solvedPuzzleIds).not.toContain(PUZZLES[0].id);
    },
  },
];

test('the final correct filing triggers the Engine ending once and keeps the restored lab explorable', async ({ page }) => {
  const fixture = createAlmostCompleteFixture();
  await page.addInitScript(({ key, value }) => {
    const initializedKey = `${key}.e2e-fixture-initialized`;
    if (window.sessionStorage.getItem(initializedKey) === 'true') return;
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(initializedKey, 'true');
  }, {
    key: autoSaveKey,
    value: fixture.encodedSave,
  });
  await page.goto('/');
  await observeAudioEvents(page);

  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
  await expect(page.getByTestId('completion-sequence')).toHaveCount(0);

  await page.getByRole('button', { name: 'Find an item' }).click();
  const search = page.getByRole('searchbox', { name: 'Search laboratory items' });
  await search.fill(fixture.finalItem.title);
  const result = page.getByTestId(`item-finder-result-${fixture.finalItem.id}`);
  await result.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('item-inspector')).toContainText(fixture.finalItem.title);
  await page.getByTestId('move-target').selectOption(fixture.finalItem.correctDestinationId);
  await page.getByTestId('move-item').click();
  await expect.poll(() => readAudioEventTypes(page)).toContain('invention.activated');
  expect(await readAudioEventTypes(page)).toEqual([
    'item.placement.correct',
    'invention.activated',
  ]);

  const ending = page.getByTestId('completion-sequence');
  await expect(ending).toBeVisible();
  const endingHeading = ending.getByRole('heading', { name: 'The laboratory is restored' });
  await expect(endingHeading).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(ending).toHaveAttribute('data-motion', 'reduced');
  await expect(ending.getByRole('status')).toBeVisible();
  await expect(ending.locator('.completion-sequence__stats')).toBeVisible();
  await expect(ending.getByTestId('completion-stat-items')).toBeVisible();
  await expect(ending.locator('.completion-sequence__projection-ring--outer')).toHaveCSS('animation-name', 'none');
  await expect(ending).toContainText(/Engine.{0,160}(?:replay|play(?:ed)? back|repeat|reconstruct|echo|recreate).{0,160}(?:impression|memory|trace|record).{0,160}Chaos Event|Chaos Event.{0,120}(?:impression|memory|trace|record).{0,120}Engine.{0,80}(?:replay|play(?:ed)? back|repeat|reconstruct|echo|recreate)/i);
  await expect(ending).toContainText(/(?:witness|observ(?:ed|er)).{0,60}(?:not|rather than|instead of).{0,40}cause|(?:not|rather than|instead of).{0,40}cause.{0,60}(?:witness|observ(?:ed|er))/i);
  await expect(ending).toContainText(/(?:Professor.{0,60}and.{0,25}Elian|Elian.{0,60}and.{0,25}Professor).{0,80}(?:witness|observed|saw)|(?:witness|observed|saw).{0,80}(?:Professor.{0,25}and.{0,25}Elian|Elian.{0,25}and.{0,25}Professor)|(?:Professor|Elian).{0,50}and.{0,25}(?:Professor|Elian).{0,80}witness/i);
  await expect(ending).toContainText(/(?:unsent|never sent).{0,40}apolog(?:y|ise)|apolog(?:y|ise).{0,40}(?:unsent|never sent)/i);
  const narrative = ending.locator('.completion-sequence__narrative');
  await expect(narrative).toContainText(/The Professor chose to keep the Engine recording through an unstable echo,? so their account.{0,60}surviv/i);
  await expect(narrative).not.toContainText(/strongest reading/i);
  await expect(ending).toContainText(/(?:Professor|he).{0,100}(?:chose|decided|kept|continued).{0,50}(?:to )?(?:keep |continue )?(?:record(?:ing|er)?|the recorder running)/i);
  await expect(ending).toContainText(/unstable.{0,40}echo/i);
  await expect(ending).toContainText(/(?:their|our|the).{0,25}account.{0,60}(?:surviv|preserv|endure|remain)/i);
  await expect(ending).toContainText(/records?.{0,140}(?:(?:do not|don't|cannot|can't|fail to).{0,50}(?:establish|tell|reveal|show|say)|(?:remain|leave).{0,50}(?:unclear|unknown|unanswered)).{0,100}(?:what began|how.{0,20}began|start(?:ed)?|origin|cause).{0,60}Chaos Event/i);
  await expect(ending).toContainText(/(?:Elian.{0,80}(?:response|reaction|respond(?:ed|s|ing)?|choice|what.{0,20}did next).{0,60}(?:unknown|unrecorded|unclear|unestablished|unresolved|not preserved|not described|open)|(?:unknown|unrecorded|unclear|unestablished|unresolved|not preserved|not described|open).{0,60}Elian.{0,40}(?:response|reaction|respond(?:ed|s|ing)?|choice|what.{0,20}did next))/i);
  await expect(ending.getByTestId('completion-stat-items')).toContainText('174 of 174');
  await expect(ending.getByTestId('completion-stat-percent')).toHaveText('100%');
  await expect(ending.getByTestId('completion-stat-collections')).toContainText(`${COLLECTIONS.length} of ${COLLECTIONS.length}`);
  await expect(ending.getByTestId('completion-stat-puzzles')).toContainText(`${PUZZLES.length} of ${PUZZLES.length}`);
  await expect(ending.getByTestId('completion-stat-discoveries')).toHaveText('5');
  await expect(ending.getByTestId('completion-stat-skills')).toHaveText('2');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const initialSave = decodeSave(fixture.encodedSave);
  const completedSave = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(completedSave.version).toBe(3);
  expect(completedSave.version).toBe(initialSave.version);
  expect(Object.keys(completedSave).sort()).toEqual(Object.keys(initialSave).sort());
  expect(completedSave.items).toHaveLength(174);
  expect(completedSave.items.every((item) => item.validation === 'correct' && item.placement.kind === 'destination')).toBe(true);
  expect(completedSave.items.map((item) => item.id)).toEqual(fixture.state.items.map((item) => item.id));

  const continueExploring = page.getByRole('button', { name: 'Continue exploring' });
  await continueExploring.focus();
  await page.keyboard.press('Enter');
  await expect(ending).toBeHidden();
  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
  await page.reload();

  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
  await expect(page.getByTestId('completion-sequence')).toHaveCount(0);
  await expect(page.locator('.progress-dial')).toContainText('100');
  const reloadedSave = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(reloadedSave.items.every((item) => item.validation === 'correct' && item.placement.kind === 'destination')).toBe(true);
  expect(reloadedSave.progress.completedCollectionIds).toEqual(expect.arrayContaining(COLLECTIONS.map((collection) => collection.id)));
  expect(reloadedSave.progress.solvedPuzzleIds).toEqual(expect.arrayContaining(PUZZLES.map((puzzle) => puzzle.id)));
});

test('the completion dialog recovers Tab focus when focus moves outside it', async ({ page }) => {
  const fixture = createAlmostCompleteFixture();
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: fixture.encodedSave,
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Find an item' }).click();
  const search = page.getByRole('searchbox', { name: 'Search laboratory items' });
  await search.fill(fixture.finalItem.title);
  await page.getByTestId(`item-finder-result-${fixture.finalItem.id}`).click();
  await page.getByTestId('move-target').selectOption(fixture.finalItem.correctDestinationId);
  await page.getByTestId('move-item').click();

  const ending = page.getByTestId('completion-sequence');
  await expect(ending).toBeVisible();
  await expect(ending.getByRole('heading', { name: 'The laboratory is restored' })).toBeFocused();
  const continueExploring = ending.getByRole('button', { name: 'Continue exploring' });
  const outsideControl = page.getByTestId('open-settings');

  await outsideControl.focus();
  await page.keyboard.press('Tab');
  await expect(continueExploring).toBeFocused();

  await outsideControl.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(continueExploring).toBeFocused();
  await expect(ending).toBeVisible();
});

for (const viewport of [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
]) {
  test(`the restoration ending stays readable and keyboard reachable at ${viewport.width}x${viewport.height} with 125% text`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const ending = await openEndingFromAlmostCompleteFixture(page);
    const dialog = ending.getByRole('dialog');
    const textScale = await page.locator('html').evaluate((root) => (
      getComputedStyle(root).getPropertyValue('--text-scale').trim()
    ));
    expect(textScale).toBe('1.25');

    const heading = ending.getByRole('heading', { name: 'The laboratory is restored' });
    await expect(heading).toBeFocused();
    await expect.poll(() => dialog.evaluate((node) => node.scrollHeight > node.clientHeight))
      .toBe(true);
    await dialog.evaluate((node) => { node.scrollTop = 0; });

    const narrative = ending.locator('.completion-sequence__narrative');
    const status = ending.getByRole('status');
    const stats = ending.locator('.completion-sequence__stat');
    await expect(stats).toHaveCount(6);

    for (const content of [narrative, status]) {
      await expect(content).toBeVisible();
      await expectFullyReachableWithinEndingScrollArea(content);
    }
    for (let index = 0; index < 6; index += 1) {
      const stat = stats.nth(index);
      await expect(stat).toBeVisible();
      await expectFullyReachableWithinEndingScrollArea(stat);
    }

    expect(await dialog.evaluate((node) => node.scrollTop), 'the dialog should scroll to reach its ending content')
      .toBeGreaterThan(0);

    const continueExploring = ending.getByRole('button', { name: 'Continue exploring' });
    await page.keyboard.press('Tab');
    await expect(continueExploring).toBeFocused();
    const continueBounds = await continueExploring.evaluate((button) => {
      const dialog = button.closest('.completion-sequence__dialog');
      const buttonRect = button.getBoundingClientRect();
      const dialogRect = dialog.getBoundingClientRect();
      const scrollTop = dialogRect.top + dialog.clientTop;
      const scrollLeft = dialogRect.left + dialog.clientLeft;
      return {
        top: buttonRect.top,
        bottom: buttonRect.bottom,
        left: buttonRect.left,
        right: buttonRect.right,
        scrollTop,
        scrollBottom: scrollTop + dialog.clientHeight,
        scrollLeft,
        scrollRight: scrollLeft + dialog.clientWidth,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      };
    });
    expect(continueBounds.top, 'Continue should be within the dialog scrollport after keyboard focus')
      .toBeGreaterThanOrEqual(continueBounds.scrollTop - 1);
    expect(continueBounds.bottom, 'Continue should be within the dialog scrollport after keyboard focus')
      .toBeLessThanOrEqual(continueBounds.scrollBottom + 1);
    expect(continueBounds.left, 'Continue should be inside the visible window after keyboard focus')
      .toBeGreaterThanOrEqual(Math.max(continueBounds.scrollLeft, 0) - 1);
    expect(continueBounds.right, 'Continue should be inside the visible window after keyboard focus')
      .toBeLessThanOrEqual(Math.min(continueBounds.scrollRight, continueBounds.windowWidth) + 1);
    expect(continueBounds.top, 'Continue should be inside the visible window after keyboard focus')
      .toBeGreaterThanOrEqual(-1);
    expect(continueBounds.bottom, 'Continue should be inside the visible window after keyboard focus')
      .toBeLessThanOrEqual(continueBounds.windowHeight + 1);

    const horizontalMeasurements = await ending.locator([
      '.completion-sequence',
      '.completion-sequence__dialog',
      '.completion-sequence__content',
      '.completion-sequence__stats',
      '.completion-sequence__stat',
    ].join(', ')).evaluateAll((elements) => elements.map((element) => ({
      name: element.className,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right,
    })));
    for (const measurement of horizontalMeasurements) {
      expect(measurement.scrollWidth, `${measurement.name} should not overflow horizontally`)
        .toBeLessThanOrEqual(measurement.clientWidth + 1);
      expect(measurement.left, `${measurement.name} should remain inside the viewport`)
        .toBeGreaterThanOrEqual(-1);
      expect(measurement.right, `${measurement.name} should remain inside the viewport`)
        .toBeLessThanOrEqual(viewport.width + 1);
    }

    await page.keyboard.press('Enter');
    await expect(ending).toBeHidden();
  });
}

test('importing a restored save shows the ending without activation, then real completion activates once', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('completion-sequence')).toHaveCount(0);
  await observeAudioEvents(page);
  expect(await readAudioEventTypes(page)).toEqual([]);

  await page.getByTestId('open-saves').click();
  await page.getByTestId('save-import-string').fill(encodeSave(createFullyFiledState()));
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  await page.getByRole('button', { name: 'Validate & import save' }).click();

  await expect(page.getByTestId('save-feedback')).toContainText(/save imported/i);
  await expect(page.getByTestId('completion-sequence')).toBeVisible();
  await expect.poll(async () => (await readAudioEventTypes(page)).filter((type) => type === 'invention.activated')).toEqual([]);

  await page.getByRole('button', { name: 'Continue exploring' }).click();
  await expect(page.getByTestId('completion-sequence')).toHaveCount(0);

  const incompleteFixture = createAlmostCompleteFixture();
  await page.getByTestId('save-import-string').fill(incompleteFixture.encodedSave);
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  await page.getByRole('button', { name: 'Validate & import save' }).click();
  await expect(page.getByTestId('save-feedback')).toContainText(/save imported/i);
  await expect(page.getByTestId('completion-sequence')).toHaveCount(0);

  await page.getByRole('button', { name: 'Close save dialog' }).click();
  await page.getByRole('button', { name: 'Find an item' }).click();
  const search = page.getByRole('searchbox', { name: 'Search laboratory items' });
  await search.fill(incompleteFixture.finalItem.title);
  const result = page.getByTestId(`item-finder-result-${incompleteFixture.finalItem.id}`);
  await result.focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('move-target').selectOption(incompleteFixture.finalItem.correctDestinationId);
  await page.getByTestId('move-item').click();

  await expect(page.getByTestId('completion-sequence')).toBeVisible();
  const eventTypes = await readAudioEventTypes(page);
  expect(eventTypes.filter((type) => type === 'invention.activated')).toHaveLength(1);
  expect(eventTypes.slice(-2)).toEqual(['item.placement.correct', 'invention.activated']);
});

for (const scenario of incompleteCompletionScenarios) {
  test(`the completion ending stays absent for a valid v3 save with ${scenario.name}`, async ({ page }) => {
    const state = scenario.createState();
    scenario.verifyState(state);
    const encodedSave = encodeSave(state);
    expect(decodeSave(encodedSave).version).toBe(3);

    await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
      key: autoSaveKey,
      value: encodedSave,
    });
    await page.goto('/');

    await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
    await expect(page.getByTestId('completion-sequence')).toHaveCount(0);
  });
}
