import { expect, test } from '@playwright/test';

const studies = [
  { species: 'crab', id: 'tidepool-trouper', title: 'Tidepool Trouper', act: 'Raise claws', key: 'h', touch: [.20, .70] },
  { species: 'butterfly', id: 'sunpatch', title: 'Sunpatch', act: 'Invite to flower', key: 'b', touch: [.80, .82] },
] as const;

for (const study of studies) {
  const route = `/ascii-animals/animals/${study.species}/`;
  test(`${study.title}: separate selection, history and canonical`, async ({ page }) => {
    await page.goto(route);
    const host = page.getByTestId('renderer-host');
    await expect(host).toHaveAttribute('data-status', 'ready');
    await expect(host).toHaveAttribute('data-variation', 'original');
    if (process.env.NATURE_CAPTURES) await host.screenshot({ path: `${process.env.NATURE_CAPTURES}/${study.species}-desktop-original.png` });
    const picker = page.getByRole('radio', { name: study.title });
    await picker.click();
    await expect(picker).toBeFocused();
    const active = host.locator(`canvas[data-renderer-variation="${study.id}"]`);
    await expect(active).toBeVisible();
    if (process.env.NATURE_CAPTURES) await host.screenshot({ path: `${process.env.NATURE_CAPTURES}/${study.species}-desktop-variation.png` });
    await expect(host.locator('canvas')).toHaveCount(1);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', new RegExp(`${route}$`));
    await expect(page).toHaveURL(new RegExp(`variation=${study.id}$`));
    await page.goBack();
    await expect(host).toHaveAttribute('data-variation', 'original');
    await page.goForward();
    await expect(active).toBeVisible();
    await page.reload();
    await expect(active).toBeVisible();
    await expect(host.locator('canvas')).toHaveCount(1);
    await page.getByRole('link', { name: 'Back to catalogue', exact: true }).click();
    await expect(active).toHaveCount(0);
  });

  test(`${study.title}: 360px deliberate stills, keyboard and actual touch`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 790 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const host = page.getByTestId('renderer-host');
      if (process.env.NATURE_CAPTURES) {
        await page.goto(route);
        await expect(host).toHaveAttribute('data-status', 'ready');
        await host.screenshot({ path: `${process.env.NATURE_CAPTURES}/${study.species}-phone-original.png` });
      }
      await page.goto(`${route}?variation=${study.id}`);
      const canvas = host.locator('canvas');
      await expect(host).toHaveAttribute('data-status', 'ready');
      await expect(host).toHaveAttribute('data-paused', 'true');
      await canvas.scrollIntoViewIfNeeded();
      const pixels = () => canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
      const original = await pixels();
      if (process.env.NATURE_CAPTURES) await host.screenshot({ path: `${process.env.NATURE_CAPTURES}/${study.species}-phone-variation.png` });
      await page.getByRole('button', { name: study.act }).click();
      await expect(page.getByText(`${study.act}: still pose shown.`)).toBeVisible();
      await expect.poll(pixels).not.toBe(original);
      const action = await pixels();
      if (process.env.NATURE_CAPTURES) await host.screenshot({ path: `${process.env.NATURE_CAPTURES}/${study.species}-phone-reaction.png` });
      await canvas.focus();
      await canvas.press(study.key);
      await expect.poll(pixels).not.toBe(action);
      const keyboard = await pixels();
      const box = (await canvas.boundingBox())!;
      await page.touchscreen.tap(box.x + box.width * study.touch[0], box.y + box.height * study.touch[1]);
      await expect.poll(pixels).not.toBe(keyboard);
      const touch = await pixels();
      await expect.poll(pixels).toBe(touch);
      await expect(page.getByRole('radio', { name: study.title })).toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
    } finally { await context.close(); }
  });

  test(`${study.title}: motion stops offscreen and on gallery return`, async ({ page }) => {
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
      Object.defineProperty(window, 'natureFrameCount', { get: () => pending.size });
    });
    const frames = () => page.evaluate(() => (window as unknown as { natureFrameCount: number }).natureFrameCount);
    await page.goto(`${route}?variation=${study.id}`);
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

}
