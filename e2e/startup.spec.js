import { expect, test } from '@playwright/test';

test('a JavaScript module served with a JSX MIME type shows startup recovery guidance', async ({ page }) => {
  let entryRequestIntercepted = false;
  let documentHtmlPromise;

  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/') documentHtmlPromise = response.text();
  });

  await page.route((url) => url.pathname === '/src/main.jsx', (route) => {
    entryRequestIntercepted = true;
    return route.fulfill({
      status: 200,
      contentType: 'text/jsx',
      body: 'export default function App() { return null; }',
    });
  });

  await page.goto('/');

  expect(entryRequestIntercepted, 'the test must intercept the Vite entry request, including URLs with query strings').toBe(true);
  expect(documentHtmlPromise, 'the browser should receive the Vite-served index HTML').toBeDefined();
  const servedHtml = await documentHtmlPromise;
  const moduleEntry = servedHtml.match(/<script\b(?=[^>]*\bsrc=["'][^"']*\/src\/main\.jsx(?:\?[^"']*)?["'])[^>]*>/i);
  expect(moduleEntry, 'the served HTML should contain the Vite module entry').not.toBeNull();
  expect(moduleEntry[0], 'the served module entry should not depend on a stable ID').not.toMatch(/\bid=["']app-entry["']/i);

  const startupAlert = page.getByRole('alert');
  await expect(startupAlert, 'the blank app should be replaced with a visible startup error').toBeVisible();
  await expect(startupAlert, 'the recovery steps should tell the developer how to start Vite').toContainText(/npm run dev/);
  await expect(startupAlert, 'the recovery steps should point to the local Vite URL').toContainText(/https?:\/\/(?:127\.0\.0\.1|localhost):5173/);
});

test('normal Vite startup keeps the load error hidden and renders the world item count', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#app-load-error')).toBeHidden();
  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
});
