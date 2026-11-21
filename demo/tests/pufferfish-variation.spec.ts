import { expect, test } from '@playwright/test';

const route = '/ascii-animals/animals/pufferfish/';
const alternate = 'reef-curmudgeon';
const url = () => route + '?variation=' + alternate;

test('Reef Curmudgeon loads only on demand, keeps one canvas and preserves the canonical URL', async ({ page }) => {
  const errors: string[] = [];
  const scripts = new Set<string>();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.resourceType() === 'script') scripts.add(request.url()); });
  await page.goto(route + '?source=field#main-content');
  const host = page.getByTestId('renderer-host');
  const canvas = host.locator('canvas');
  await expect(host).toHaveAttribute('data-status', 'ready');
  await expect(host).toHaveAttribute('data-variation', 'original');
  await expect(canvas).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Puff up', exact: true })).toHaveCount(0);
  const originalScripts = new Set(scripts);
  await page.getByRole('button', { name: 'Pause animation' }).click();
  const original = page.getByRole('radio', { name: 'Original', exact: true });
  const character = page.getByRole('radio', { name: 'Reef Curmudgeon', exact: true });
  await original.focus();
  await page.keyboard.press('ArrowRight');
  await expect(character).toBeFocused();
  await expect(character).toBeChecked();
  await expect(host).toHaveAttribute('data-status', 'ready');
  await expect(host).toHaveAttribute('data-paused', 'true');
  await expect(page).toHaveURL(route + '?source=field&variation=reef-curmudgeon#main-content');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('data-renderer-variation', alternate);
  expect([...scripts].some(script => !originalScripts.has(script))).toBe(true);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://castlemilk.github.io' + route);
  await expect(page.getByRole('region', { name: 'Movement controls' })).toHaveCount(0);
  await page.goBack();
  await expect(original).toBeChecked();
  await expect(host).toHaveAttribute('data-status', 'ready');
  await expect(host).toHaveAttribute('data-paused', 'true');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).not.toHaveAttribute('data-renderer-variation');
  await page.goForward();
  await expect(character).toBeChecked();
  await page.reload();
  await expect(canvas).toHaveAttribute('data-renderer-variation', alternate);
  expect(errors).toEqual([]);
});

test('360px touch and reduced motion select visible static poses without starting animation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(url());
    const host = page.getByTestId('renderer-host');
    await expect(host).toHaveAttribute('data-status', 'ready');
    await expect(host).toHaveAttribute('data-paused', 'true');
    await expect(page.getByRole('radio', { name: 'Reef Curmudgeon' })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Play animation' })).toBeDisabled();
    const canvas = host.locator('canvas');
    const image = () => canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
    const calm = await image();
    await page.getByRole('button', { name: 'Puff up', exact: true }).tap();
    await expect(page.getByText('Puff up: still frame shown.')).toBeVisible();
    const puff = await image();
    expect(puff).not.toBe(calm);
    await page.getByRole('button', { name: 'Give space', exact: true }).tap();
    await expect(page.getByText('Give space: still frame shown.')).toBeVisible();
    expect(await image()).not.toBe(puff);
    await page.getByRole('button', { name: 'Invite closer', exact: true }).tap();
    await expect(page.getByText('Invite closer: still frame shown.')).toBeVisible();
    const centralInvitation = await image();
    await canvas.tap({ position: { x: 25, y: 75 } });
    const leftInvitation = await image();
    expect(leftInvitation).not.toBe(centralInvitation);
    await canvas.focus();
    await page.keyboard.press('i');
    expect(await image()).toBe(centralInvitation);
    await expect(canvas).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
    await page.goto(route + '?variation=ink-puppet');
    await expect(host).toHaveAttribute('data-variation', 'original');
    await expect(page).toHaveURL(route + '?variation=ink-puppet');
  } finally {
    await context.close();
  }
});

test('the alternate suspends offscreen and releases its animation on return to the catalogue', async ({ page }) => {
  await page.setViewportSize({ width: 1240, height: 360 });
  await page.addInitScript(() => {
    const pending = new Set<number>();
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      const id = request(time => { pending.delete(id); callback(time); });
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    Object.defineProperty(window, 'galleryVariantFrames', { get: () => pending.size });
  });
  const frames = () => page.evaluate(() => (window as unknown as { galleryVariantFrames: number }).galleryVariantFrames);
  await page.goto(url());
  const host = page.getByTestId('renderer-host');
  await expect(host).toHaveAttribute('data-status', 'ready');
  await host.scrollIntoViewIfNeeded();
  await expect.poll(frames).toBe(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(host).not.toBeInViewport();
  await expect.poll(frames).toBe(0);
  await host.scrollIntoViewIfNeeded();
  await expect.poll(frames).toBe(1);
  await page.getByRole('link', { name: 'Back to catalogue', exact: true }).click();
  await expect(host).toHaveCount(0);
  await expect.poll(frames).toBe(0);
});
