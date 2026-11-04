import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const skills = [
  {
    id: 'resonance-lens',
    purchaseName: /Build lens/i,
    activationName: /Activate lens/i,
  },
  {
    id: 'missing-member-compass',
    purchaseName: /Build compass/i,
    activationName: /Activate compass/i,
  },
  {
    id: 'aether-wayfinder',
    purchaseName: /Build Wayfinder/i,
    activationName: /Trace destination/i,
  },
  {
    id: 'modular-worktables',
    purchaseName: /Expand tables/i,
    passive: true,
  },
];

async function seedGame(page, { textScale } = {}) {
  const state = createNewGameState();
  state.progress.skillPoints = 5;

  await page.addInitScript(({ key, value, preferencesKey, preferences }) => {
    window.localStorage.setItem(key, value);
    if (preferences) window.localStorage.setItem(preferencesKey, preferences);
  }, {
    key: autoSaveKey,
    value: encodeSave(state),
    preferencesKey: PREFERENCES_STORAGE_KEY,
    preferences: textScale === undefined
      ? null
      : JSON.stringify({ version: 1, textScale, reduceMotion: false, soundEffectsEnabled: false }),
  });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
}

async function expectFullContentWidth(element, card, description) {
  const [elementBox, cardContent] = await Promise.all([
    element.boundingBox(),
    card.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const borderLeft = Number.parseFloat(style.borderLeftWidth);
      const borderRight = Number.parseFloat(style.borderRightWidth);
      const paddingLeft = Number.parseFloat(style.paddingLeft);
      const paddingRight = Number.parseFloat(style.paddingRight);
      return {
        left: rect.left + borderLeft + paddingLeft,
        right: rect.right - borderRight - paddingRight,
      };
    }),
  ]);

  expect(elementBox, `${description} should have rendered geometry`).not.toBeNull();
  expect(elementBox.x, `${description} should start at the card content edge`).toBeCloseTo(cardContent.left, 0);
  expect(elementBox.x + elementBox.width, `${description} should end at the card content edge`).toBeCloseTo(cardContent.right, 0);
}

async function expectFocusedActionVisible(panel, action) {
  await expect(action).toBeFocused();
  const visibility = await panel.evaluate((element) => {
    const panelRect = element.getBoundingClientRect();
    const focusedRect = document.activeElement.getBoundingClientRect();
    const panelLeft = panelRect.left + element.clientLeft;
    const panelTop = panelRect.top + element.clientTop;
    const panelRight = panelLeft + element.clientWidth;
    const panelBottom = panelTop + element.clientHeight;
    const tolerance = 1;
    const hit = document.elementFromPoint(
      focusedRect.left + focusedRect.width / 2,
      focusedRect.top + focusedRect.height / 2,
    );

    return {
      fullRectVisible: focusedRect.left >= Math.max(0, panelLeft) - tolerance
        && focusedRect.right <= Math.min(window.innerWidth, panelRight) + tolerance
        && focusedRect.top >= Math.max(0, panelTop) - tolerance
        && focusedRect.bottom <= Math.min(window.innerHeight, panelBottom) + tolerance,
      hitTestable: hit === document.activeElement || document.activeElement.contains(hit),
    };
  });
  expect(visibility.fullRectVisible, 'focused skill action should stay fully visible inside the panel and viewport').toBe(true);
  expect(visibility.hitTestable, 'focused skill action should be hit-testable at its center').toBe(true);
}

async function expectSkillsPanelFits(panel, viewport) {
  const layout = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      panelInViewport: rect.left >= 0 && rect.right <= window.innerWidth
        && rect.top >= 0 && rect.bottom <= window.innerHeight,
      panelHasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      pageHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      panelScrollsVertically: element.scrollHeight > element.clientHeight,
    };
  });

  expect(layout.panelInViewport, `skills panel should fit ${viewport.width}x${viewport.height}`).toBe(true);
  expect(layout.panelHasHorizontalOverflow, 'skill content should not overflow horizontally').toBe(false);
  expect(layout.pageHasHorizontalOverflow, 'page should not overflow horizontally').toBe(false);
  expect(layout.panelScrollsVertically, 'skills panel should scroll internally at 150%').toBe(true);
}

async function expectCompactSkillsHeaderFits(panel) {
  const layout = await panel.evaluate((element) => {
    const panelRect = element.getBoundingClientRect();
    const panelLeft = panelRect.left + element.clientLeft;
    const panelTop = panelRect.top + element.clientTop;
    const panelRight = panelLeft + element.clientWidth;
    const panelBottom = panelTop + element.clientHeight;
    const headingRect = element.querySelector('h2').getBoundingClientRect();
    const pointsRect = element.querySelector('.skill-points').getBoundingClientRect();
    const toolbarRect = document.querySelector('.game-toolbar').getBoundingClientRect();

    return {
      toolbarGap: toolbarRect.top - panelRect.bottom,
      headingInsidePanel: headingRect.left >= panelLeft && headingRect.right <= panelRight
        && headingRect.top >= panelTop && headingRect.bottom <= panelBottom,
      pointsInsidePanel: pointsRect.left >= panelLeft && pointsRect.right <= panelRight
        && pointsRect.top >= panelTop && pointsRect.bottom <= panelBottom,
    };
  });

  expect(layout.toolbarGap, 'compact skills panel should end at least 8px above the toolbar').toBeGreaterThanOrEqual(8);
  expect(layout.headingInsidePanel, 'Workshop Skills heading should fit inside the visible panel client bounds').toBe(true);
  expect(layout.pointsInsidePanel, 'insight points badge should fit inside the visible panel client bounds').toBe(true);
}

for (const viewport of [{ width: 390, height: 480 }, { width: 1280, height: 720 }]) {
  test(`skill card actions and hints span the card content at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedGame(page);
    await page.getByTestId('toggle-skills').click();

    const panel = page.getByTestId('skills-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Workshop Skills' })).toBeVisible();

    for (const skill of skills) {
      const card = page.getByTestId(`skill-${skill.id}`);
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();

      const purchase = card.getByTestId(`purchase-${skill.id}`);
      await expect(purchase).toBeVisible();
      await expect(purchase).toHaveAccessibleName(skill.purchaseName);
      await expect(purchase).toBeEnabled();
      await expectFullContentWidth(purchase, card, `${skill.id} purchase action`);
      await purchase.click();

      if (skill.passive) {
        const status = card.locator('.skill-selection-hint');
        await expect(status).toBeVisible();
        await expect(status).toHaveAttribute('role', 'status');
        await expectFullContentWidth(status, card, `${skill.id} installed status`);
        continue;
      }

      const activation = card.getByTestId(`toggle-${skill.id}`);
      await expect(activation).toBeVisible();
      await expect(activation).toHaveAccessibleName(skill.activationName);
      await expect(activation).toHaveAttribute('aria-pressed', 'false');
      await expect(activation).toBeDisabled();
      await expectFullContentWidth(activation, card, `${skill.id} activation action`);

      const hint = card.locator('.skill-selection-hint');
      await expect(hint).toBeVisible();
      await expectFullContentWidth(hint, card, `${skill.id} selection hint`);
    }
  });
}

for (const viewport of [
  { width: 320, height: 360 },
  { width: 360, height: 399 },
  { width: 320, height: 480 },
  { width: 390, height: 480 },
  { width: 320, height: 400 },
  { width: 390, height: 400 },
]) {
  test(`150% text scale keeps skill actions keyboard-visible at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedGame(page, { textScale: 1.5 });
    await expect(page.locator('html')).toHaveCSS('--text-scale', '1.5');
    await page.getByTestId('toggle-skills').click();

    const panel = page.getByTestId('skills-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Workshop Skills' })).toBeVisible();
    await expectSkillsPanelFits(panel, viewport);
    if (viewport.width <= 360 && viewport.height >= 360 && viewport.height <= 399) {
      await expectCompactSkillsHeaderFits(panel);
    }

    const panelScrollTopBeforeTraversal = await panel.evaluate((element) => element.scrollTop);
    const firstPurchase = page.getByTestId('purchase-resonance-lens');
    await page.getByTestId('toggle-skills').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('open-saves')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('open-settings')).toBeFocused();
    await page.keyboard.press('Tab');
    await expectFocusedActionVisible(panel, firstPurchase);

    for (const [index, skill] of skills.entries()) {
      const card = page.getByTestId(`skill-${skill.id}`);
      const purchase = card.getByTestId(`purchase-${skill.id}`);
      await expect(purchase).toBeFocused();
      await expect(purchase).toBeEnabled();
      await expect(purchase).toHaveAccessibleName(skill.purchaseName);
      await expectFullContentWidth(purchase, card, `${skill.id} purchase action at 150%`);
      await expectFocusedActionVisible(panel, purchase);
      if (index < skills.length - 1) {
        await page.keyboard.press('Tab');
        await expectFocusedActionVisible(panel, page.getByTestId(`purchase-${skills[index + 1].id}`));
      }
    }

    const panelScrollTopAfterTraversal = await panel.evaluate((element) => element.scrollTop);
    expect(panelScrollTopAfterTraversal, 'Tab traversal should scroll the skill panel to lower actions')
      .toBeGreaterThan(panelScrollTopBeforeTraversal);
  });
}
