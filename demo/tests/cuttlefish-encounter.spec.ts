import { expect, test } from '@playwright/test';

test('original Cuttlefish studio keeps mid-size arms within the lens frame', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 940 });
  await page.clock.install({ time: new Date('2026-11-20T00:00:00Z') });
  expect((await page.goto('/ascii-animals/cuttlefish-demo.html'))?.status()).toBe(200);
  await page.locator('[data-school-preset="solo"]').click();
  await page.locator('#size').fill('0.7');
  const canvas = page.locator('#artwork');
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(10_200);
  await page.locator('#pause-btn').click();
  await expect(page.locator('#scene-phase')).toHaveText('Exploring the lens');
  const ink = await canvas.evaluate(node => {
    const surface = node as HTMLCanvasElement;
    const { width, height } = surface;
    const pixels = surface.getContext('2d')!.getImageData(0, 0, width, height).data;
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 120) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return {
      widthSpan: (right - left + 1) / width, heightSpan: (bottom - top + 1) / height,
      margin: Math.min(left, top, width - 1 - right, height - 1 - bottom),
    };
  });
  expect(ink.widthSpan).toBeGreaterThan(.65);
  expect(ink.heightSpan).toBeGreaterThan(.58);
  expect(ink.margin).toBeGreaterThanOrEqual(5);
});
