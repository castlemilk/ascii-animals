import { test, expect, type Page } from '@playwright/test';

const base = '/ascii-animals';
type Probe = { pendingFrames: number; detachedPaints: number; rendererObservers: number };

async function installProbe(page: Page) {
  await page.addInitScript(() => {
    const pending = new Set<number>();
    const observers = new Set<Map<Element, boolean>>();
    let detachedPaints = 0;
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      const id = request(time => { pending.delete(id); callback(time); });
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    const draw = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof draw>) {
      // Private glyph atlases are intentionally detached. Only the artwork
      // surface owned by this demo is relevant to route disposal.
      if (this.canvas.matches('[data-renderer-species]') && !this.canvas.isConnected) detachedPaints++;
      return draw.apply(this, args);
    };
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeResizeObserver {
      private targets = new Map<Element, boolean>();
      constructor(callback: ResizeObserverCallback) { super(callback); observers.add(this.targets); }
      observe(target: Element, options?: ResizeObserverOptions) {
        // Capture relevance while connected: a leaked observer remains counted
        // after its target is detached, until unobserve/disconnect releases it.
        this.targets.set(target, Boolean(target.closest('[data-testid="renderer-host"]')));
        super.observe(target, options);
      }
      unobserve(target: Element) { this.targets.delete(target); super.unobserve(target); }
      disconnect() { this.targets.clear(); super.disconnect(); }
    };
    Object.defineProperty(window, '__asciiDemoProbe', { value: {
      get pendingFrames() { return pending.size; },
      get detachedPaints() { return detachedPaints; },
      get rendererObservers() { return [...observers].reduce((count, targets) => count + [...targets.values()].filter(Boolean).length, 0); },
    } });
  });
}

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const state = (window as unknown as { __asciiDemoProbe: Probe }).__asciiDemoProbe;
    return { pendingFrames: state.pendingFrames, detachedPaints: state.detachedPaints, rendererObservers: state.rendererObservers };
  });
}

test('route changes dispose the active renderer, cancel its frame loop and tolerate late imports', async ({ page }) => {
  await installProbe(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/animals/cuttlefish/`);
  const host = page.getByTestId('renderer-host');
  await expect(host).toHaveAttribute('data-status', 'ready');
  await expect.poll(async () => (await probe(page)).pendingFrames).toBe(1);

  let delayedChunks = 0;
  await page.route('**/_next/static/chunks/*.js', async route => {
    delayedChunks++;
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.continue();
  });
  const nav = page.getByRole('navigation', { name: 'Animals', exact: true });
  await nav.getByRole('link', { name: 'Fox', exact: true }).click();
  await expect(host).toHaveAttribute('data-species', 'fox');
  await expect(host).toHaveAttribute('data-status', 'loading');
  await nav.getByRole('link', { name: 'Manta ray', exact: true }).click();
  await expect(host).toHaveAttribute('data-species', 'manta');
  await expect(host).toHaveAttribute('data-status', 'ready');
  await expect(host.locator('canvas')).toHaveCount(1);
  expect(delayedChunks).toBeGreaterThan(0);
  await expect.poll(async () => (await probe(page)).pendingFrames).toBe(1);
  await page.getByRole('link', { name: 'Back to catalogue', exact: true }).click();
  await expect(host).toHaveCount(0);
  await expect.poll(async () => (await probe(page)).pendingFrames).toBe(0);
  await expect.poll(async () => (await probe(page)).rendererObservers).toBe(0);
  // Allow the delayed Fox import and at least several frame opportunities to
  // finish after unmount; no stale constructor or detached painting is allowed.
  await page.waitForTimeout(450);
  expect(await probe(page)).toEqual({ pendingFrames: 0, detachedPaints: 0, rendererObservers: 0 });
  expect(errors).toEqual([]);
});

test('OS reduced motion initializes a still view and live changes stop playback without silent restart', async ({ page }) => {
  await installProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/animals/fox/`);
  const host = page.getByTestId('renderer-host');
  await expect(host).toHaveAttribute('data-status', 'ready');
  await expect(host).toHaveAttribute('data-paused', 'true');
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled();
  await expect.poll(async () => (await probe(page)).pendingFrames).toBe(0);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(host).toHaveAttribute('data-paused', 'true');
  const play = page.getByRole('button', { name: 'Play animation', exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  await expect(host).toHaveAttribute('data-paused', 'false');
  await expect.poll(async () => (await probe(page)).pendingFrames).toBe(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(host).toHaveAttribute('data-paused', 'true');
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled();
  await expect.poll(async () => (await probe(page)).pendingFrames).toBe(0);
  await page.getByRole('link', { name: 'Previous: Owl', exact: true }).click();
  await expect(host).toHaveAttribute('data-species', 'owl');
  await expect(host).toHaveAttribute('data-status', 'ready');
  await expect(host).toHaveAttribute('data-paused', 'true');
  await expect.poll(async () => (await probe(page)).pendingFrames).toBe(0);
});

test('manual pause survives a species route change', async ({ page }) => {
  await page.goto(`${base}/animals/cuttlefish/`);
  const host = page.getByTestId('renderer-host');
  await expect(host).toHaveAttribute('data-status', 'ready');
  const surface = host.locator('[data-renderer-species]');
  await surface.focus();
  await page.keyboard.press('Space');
  await expect(host).toHaveAttribute('data-paused', 'true');
  await page.keyboard.press('Space');
  await expect(host).toHaveAttribute('data-paused', 'false');
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await expect(host).toHaveAttribute('data-paused', 'true');
  await page.getByRole('button', { name: 'Restart study', exact: true }).click();
  await expect(host).toHaveAttribute('data-paused', 'true');
  await page.getByRole('checkbox', { name: /^Still mode/ }).check();
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: /^Still mode/ }).uncheck();
  await expect(host).toHaveAttribute('data-paused', 'true');
  await page.getByRole('link', { name: 'Next: Manta ray', exact: true }).click();
  await expect(host).toHaveAttribute('data-species', 'manta');
  await expect(host).toHaveAttribute('data-status', 'ready');
  await expect(host).toHaveAttribute('data-paused', 'true');
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  await expect(host).toHaveAttribute('data-paused', 'false');
});
