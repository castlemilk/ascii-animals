import { expect, test, type Locator } from '@playwright/test';

function footprint(canvas: Locator) {
  return canvas.evaluate(node => {
    const surface = node as HTMLCanvasElement;
    const { width, height } = surface;
    const pixels = surface.getContext('2d')!.getImageData(0, 0, width, height).data;
    let left = width, top = height, right = -1, bottom = -1, brightPixels = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 120) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      brightPixels++;
    }
    return { widthSpan: (right - left + 1) / width, heightSpan: (bottom - top + 1) / height, brightPixels };
  });
}

function bitmap(canvas: Locator) {
  return canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL('image/png'));
}

for (const [device, width, height] of [['desktop', 1280, 940], ['touch phone', 390, 844]] as const) {
  test(`original Cuttlefish lens: small approach and shared full-frame contact on ${device}`, async ({ browser, baseURL }, info) => {
    const measures = [];
    for (const size of ['0.35', '1.4']) {
      const context = await browser.newContext({ baseURL, viewport: {width, height},
        isMobile: device === 'touch phone', hasTouch: device === 'touch phone', deviceScaleFactor: 1 });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        const now = new Date('2026-11-20T00:00:00Z');
        await page.clock.install({time: now});
        await page.clock.pauseAt(new Date(now.getTime() + 3000));
        expect((await page.goto('/ascii-animals/cuttlefish-demo.html'))?.status()).toBe(200);
        await page.locator('[data-school-preset="solo"]').click({force: true});
        await page.locator('#size').fill(size);
        const canvas = page.locator('#artwork');
        await canvas.scrollIntoViewIfNeeded();
        await page.clock.runFor(3500);
        const approach = await footprint(canvas);
        await page.clock.runFor(6700);
        await expect(page.locator('#scene-phase')).toHaveText('Exploring the lens');
        const contact = await footprint(canvas);
        await info.attach(`${device} lens ${size}`, {body: await canvas.screenshot(), contentType: 'image/png'});
        const pause = page.locator('#pause-btn');
        await pause.click({force: true});
        await expect(pause).toHaveAttribute('aria-label', 'Play animation');
        // Pause synchronously paints the settled frame before unsubscribing.
        // Compare that frame, not the last live paint, to the later bitmap.
        const paused = await bitmap(canvas);
        await page.clock.runFor(650);
        expect(await bitmap(canvas) === paused, 'paused bitmap remains identical').toBe(true);
        await pause.click({force: true});
        await expect(pause).toHaveAttribute('aria-label', 'Pause animation');
        await page.clock.runFor(650);
        expect(await bitmap(canvas) === paused, 'resumed animation paints a different bitmap').toBe(false);
        expect(errors).toEqual([]);
        measures.push({approach, contact});
      } finally { await context.close(); }
    }
    const [small, large] = measures;
    expect(small.approach.widthSpan).toBeLessThan(large.approach.widthSpan * .55);
    expect(small.approach.heightSpan).toBeLessThan(large.approach.heightSpan * .55);
    expect(small.contact).toEqual(large.contact);
    expect(small.contact.widthSpan).toBeGreaterThan(.97);
    expect(small.contact.heightSpan).toBeGreaterThan(.97);
  });
}
