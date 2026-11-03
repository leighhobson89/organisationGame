import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';

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

async function seedGame(page) {
  const state = createNewGameState();
  state.progress.skillPoints = 5;

  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: autoSaveKey, value: encodeSave(state) });
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
