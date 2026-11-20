import { expect, test, type Locator } from '@playwright/test';

const base = '/ascii-animals';

async function visibleInk(canvas: Locator) {
  return canvas.evaluate((node: HTMLCanvasElement) => {
    const context = node.getContext('2d');
    if (!context || !node.width || !node.height) return { count: 0, centreX: 0 };
    const { data } = context.getImageData(0, 0, node.width, node.height);
    let count = 0, total = 0;
    for (let y = 0; y < node.height; y += 3) for (let x = 0; x < node.width; x += 3) {
      const i = (y * node.width + x) * 4;
      if (Math.max(data[i], data[i + 1], data[i + 2]) > 115) { count++; total += x; }
    }
    return { count, centreX: count ? total / count / node.width : 0 };
  });
}

test('opt-in journey crosses the same canvas and exits without repeating', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/animals/manta/`);
  const host = page.getByTestId('renderer-host');
  await expect(host).toHaveAttribute('data-status', 'ready');
  const canvas = host.locator('canvas');
  const original = await canvas.elementHandle();
  const journey = page.getByRole('region', { name: 'Movement controls' });
  const enabled = journey.getByRole('checkbox', { name: /travel across the screen/i });
  await expect(enabled).not.toBeChecked();
  await enabled.check();
  await journey.getByLabel('Travel time').selectOption('4');
  await journey.getByRole('checkbox', { name: 'Repeat after exit' }).uncheck();
  await page.getByRole('button', { name: 'Restart study' }).click();
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const frame = await visibleInk(canvas);
    return frame.count > 6 && frame.centreX < .44;
  }, { timeout: 8000, intervals: [30, 60, 100] }).toBe(true);
  await expect.poll(async () => {
    const frame = await visibleInk(canvas);
    return frame.count > 6 && frame.centreX > .56;
  }, { timeout: 10000, intervals: [40, 80, 120] }).toBe(true);
  await expect.poll(async () => (await visibleInk(canvas)).count, { timeout: 10000 }).toBeLessThan(5);
  await expect(canvas).toHaveCount(1);
  expect(await canvas.evaluate((node, before) => node === before, original)).toBe(true);
  await enabled.uncheck();
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await visibleInk(canvas)).count).toBeGreaterThan(6);
  expect(errors).toEqual([]);
});

test('phone controls show a still under reduced motion; non-marine routes have no panel', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/animals/cuttlefish/`);
    const host = page.getByTestId('renderer-host');
    await expect(host).toHaveAttribute('data-status', 'ready');
    const canvas = host.locator('canvas');
    const panel = page.getByRole('region', { name: 'Movement controls' });
    const toggle = panel.getByRole('checkbox', { name: /travel across the screen/i });
    await toggle.tap();
    await expect(toggle).toBeChecked();
    await panel.getByLabel('Path').selectOption('diagonal-up');
    await panel.getByLabel('Starting direction').selectOption('reverse');
    await panel.getByLabel('Linger halfway').selectOption('1');
    await panel.getByRole('button', { name: 'Show midpoint still' }).tap();
    await expect(page.getByRole('button', { name: 'Play animation' })).toBeDisabled();
    await canvas.scrollIntoViewIfNeeded();
    await expect.poll(async () => (await visibleInk(canvas)).count).toBeGreaterThan(6);
    const still = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
    await page.waitForTimeout(250);
    expect(await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL())).toBe(still);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(`${base}/animals/fox/`);
    await expect(page.getByTestId('renderer-host')).toHaveAttribute('data-status', 'ready');
    await expect(page.getByRole('region', { name: 'Movement controls' })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
