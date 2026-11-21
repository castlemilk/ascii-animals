import { test, expect, type Page } from '@playwright/test';

const octopus = '/ascii-animals/animals/octopus/';
const other = '/ascii-animals/animals/crab/';
const query = 'variation=pocket-trickster';

async function expectVariant(page: Page, variant: 'original' | 'pocket-trickster') {
  const host = page.getByTestId('renderer-host');
  await expect(host).toHaveAttribute('data-status', 'ready');
  await expect(host).toHaveAttribute('data-variation', variant);
  await expect(host.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('radio', { name: variant === 'original' ? 'Original' : 'Pocket Trickster', exact: true })).toBeChecked();
}

test('same-page alternate preserves input focus and URL, Back/Forward and reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(octopus + '?source=guide#main-content');
  await expectVariant(page, 'original');
  await expect(page.getByRole('region', { name: 'Movement controls' })).toBeVisible();
  const group = page.getByRole('radiogroup', { name: 'Variation' });
  const original = group.getByRole('radio', { name: 'Original', exact: true });
  const trickster = group.getByRole('radio', { name: 'Pocket Trickster', exact: true });
  await original.focus();
  await expect(original).toBeFocused();
  await expect(original).toHaveAttribute('tabindex', '0');
  await expect(trickster).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('ArrowRight');
  await expectVariant(page, 'pocket-trickster');
  await expect(trickster).toBeFocused();
  await expect(original).toHaveAttribute('tabindex', '-1');
  await expect(trickster).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Pause animation' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(trickster).toBeFocused();
  await expect(page).toHaveURL(octopus + '?source=guide&' + query + '#main-content');
  await expect(page.getByRole('region', { name: 'Movement controls' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Offer a hand' })).toBeVisible();
  await page.goBack();
  await expectVariant(page, 'original');
  await page.goForward();
  await expectVariant(page, 'pocket-trickster');
  await page.reload();
  await expectVariant(page, 'pocket-trickster');
  expect(errors).toEqual([]);
});

test('invalid, empty, duplicate and other-species variation URLs are left alone', async ({ page }) => {
  for (const input of ['variation=missing', 'variation=', query + '&' + query]) {
    await page.goto(octopus + '?' + input);
    await expectVariant(page, 'original');
    await expect(page).toHaveURL(octopus + '?' + input);
  }
  await page.goto(other + '?' + query);
  await expect(page.getByTestId('renderer-host')).toHaveAttribute('data-variation', 'original');
  await expect(page.getByRole('radiogroup', { name: 'Variation' })).toHaveCount(0);
  await expect(page).toHaveURL(other + '?' + query);
});

test('rapid selections, compact touch, global Still and system reduction keep one renderer', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(octopus + '?' + query);
  await expectVariant(page, 'pocket-trickster');
  await expect(page.getByRole('button', { name: 'Offer a hand' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play animation' })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Pocket Trickster' })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.variation-options [data-slot=segmented-control-item]')];
    for (const index of [0, 1, 0, 1, 0]) buttons[index].click();
  });
  await expectVariant(page, 'original');
  await page.getByRole('radio', { name: 'Pocket Trickster' }).tap();
  await expectVariant(page, 'pocket-trickster');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: 'Offer a hand' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play animation' }).click();
  await expect(page.getByRole('button', { name: 'Offer a hand' })).toBeEnabled();
  await page.getByRole('checkbox', { name: /Still mode/ }).check();
  await expect(page.getByRole('button', { name: 'Ink and peek' })).toBeDisabled();
  await context.close();
});

test('no-JavaScript keeps the original studio and no dummy picker', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(octopus + '?' + query);
  await expect(page.getByRole('heading', { level: 1, name: 'Octopus' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Variation' })).toHaveCount(0);
  await expect(page.locator('noscript').getByRole('link', { name: 'Open the original Octopus studio' })).toBeVisible();
  await context.close();
});

test('short phone offers visible feedback when artwork is offscreen instead of silently queuing actions', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 360 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto(octopus + '?' + query);
  await expectVariant(page, 'pocket-trickster');
  const canvas = page.getByTestId('renderer-host').locator('canvas');
  const offer = page.getByRole('button', { name: 'Offer a hand' });
  await offer.evaluate(button => button.scrollIntoView({ block: 'start' }));
  await expect(canvas).not.toBeInViewport();
  await offer.tap();
  await expect(page.getByText('Bring the artwork into view, then try again.')).toBeVisible();
  await canvas.evaluate(element => element.scrollIntoView({ block: 'end' }));
  await expect(canvas).toBeInViewport();
  // Trigger from the focused button without scrolling it back over the artwork.
  await offer.evaluate(button => { button.focus({ preventScroll: true }); });
  await expect(offer).toBeFocused();
  await expect.poll(async () => {
    await page.keyboard.press('Enter');
    return await page.getByText('Invitation sent.').count();
  }).toBe(1);
  await context.close();
});
