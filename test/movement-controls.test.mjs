import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mountMovementControls } from '../examples/movement/controls.mjs';

test('movement controls can be imported on the server and reject an absent host', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof mountMovementControls, 'function');
  assert.throws(() => mountMovementControls(null, {}), /browser element/);
});

// Optional real-DOM check: no dependency is downloaded by this test. Set
// ASCII_PLAYWRIGHT_MODULE to an already installed Playwright entry point and,
// optionally, ASCII_CHROMIUM to an existing executable. A skipped test is not a
// claim about keyboard, screen-reader, touch or browser acceptance.
test('movement controls validate, remain keyboard-operable and dispose independently in Chromium', {
  skip: !process.env.ASCII_PLAYWRIGHT_MODULE,
}, async () => {
  const module = process.env.ASCII_PLAYWRIGHT_MODULE;
  const { chromium } = await import(module.startsWith('/') ? pathToFileURL(module).href : module);
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.ASCII_CHROMIUM ? { executablePath: process.env.ASCII_CHROMIUM } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><html lang="en"><head><title>Movement controls test</title></head><body><div id="one"></div><div id="two"></div></body></html>');
    await page.addStyleTag({ path: fileURLToPath(new URL('../examples/movement/controls.css', import.meta.url)) });
    const source = await readFile(new URL('../examples/movement/controls.mjs', import.meta.url), 'utf8');
    await page.evaluate(async source => {
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const { mountMovementControls } = await import(url);
      URL.revokeObjectURL(url);
      const state = {
        enabled: true, path: 'horizontal', direction: 'forward', timing: 'duration',
        durationSeconds: 12, speedPixelsPerSecond: 60, lingerSeconds: 1, repeat: true,
        edgePadding: 24, lanes: 3, staggerSeconds: 1, seed: 7,
        paused: true, reducedMotion: false, status: 'Ready',
      };
      const calls = [];
      const port = {
        getMovementControls: () => ({ ...state }),
        configureMovementControls: patch => {
          if (patch.seed === 13) throw new Error('<img src=x onerror=alert(1)> is an example error');
          calls.push(['configure', patch]);
          Object.assign(state, patch);
          state.status = 'Journey settings updated';
        },
        toggleMovementPause: () => { calls.push(['pause']); if (!state.reducedMotion) state.paused = !state.paused; },
        reverseMovement: () => { calls.push(['reverse']); },
        restartMovement: () => { calls.push(['restart']); },
        showMovementStill: progress => { calls.push(['still', progress]); state.paused = true; },
      };
      const a = mountMovementControls(document.getElementById('one'), port);
      const b = mountMovementControls(document.getElementById('two'), port);
      window.controlsTest = { state, calls, a, b };
    }, source);
    const one = page.locator('#one');
    assert.equal(await one.getByRole('heading', { name: 'Across-screen journey' }).count(), 1);
    assert.equal(await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
      return ids.length === new Set(ids).size;
    }), true, 'independently mounted views must not duplicate label IDs');

    // Native checkbox keyboard operation; other instance is untouched until its
    // host deliberately asks it to refresh the shared test port.
    const enabled = one.getByRole('checkbox', { name: 'Travel across the viewport' });
    await enabled.focus();
    await page.keyboard.press('Space');
    assert.equal(await one.getByLabel('Journey path', { exact: true }).isDisabled(), true);
    await page.keyboard.press('Space');
    assert.equal(await one.getByLabel('Journey path', { exact: true }).isEnabled(), true);
    await one.getByLabel('Journey path', { exact: true }).selectOption('free');
    await one.getByLabel('Set pace by', { exact: true }).selectOption('speed');
    assert.equal(await one.getByLabel('Travel duration', { exact: true }).isVisible(), false);
    const speed = one.getByLabel('Travel speed', { exact: true });
    assert.equal(await speed.isVisible(), true);
    await speed.fill('500');
    await speed.focus();
    await speed.dispatchEvent('change');
    assert.match(await one.getByRole('alert').textContent(), /between 10 and 300/);
    assert.equal(await speed.getAttribute('aria-invalid'), 'true');
    assert.equal(await speed.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => window.controlsTest.state.speedPixelsPerSecond), 60);
    await speed.fill('80');
    await speed.dispatchEvent('change');
    assert.equal(await speed.getAttribute('aria-invalid'), null);
    assert.equal(await one.getByRole('alert').isVisible(), false);

    await one.locator('summary').click();
    const seed = one.getByLabel('Journey seed', { exact: true });
    await seed.fill('13');
    await seed.dispatchEvent('change');
    assert.match(await one.getByRole('alert').textContent(), /<img/);
    assert.equal(await one.locator('img').count(), 0, 'port errors must remain text');
    await seed.fill('8');
    await seed.dispatchEvent('change');
    assert.equal(await one.getByRole('alert').isVisible(), false);

    await page.evaluate(() => {
      window.controlsTest.state.reducedMotion = true;
      window.controlsTest.a.refresh();
    });
    assert.equal(await one.getByRole('button', { name: 'Reduced motion · still' }).isDisabled(), true);
    await one.getByRole('button', { name: 'Show midpoint', exact: true }).click();
    await one.getByRole('button', { name: 'Restart journey', exact: true }).click();
    assert.equal(await page.evaluate(() => window.controlsTest.state.paused), true);
    assert.equal(await page.evaluate(() => window.controlsTest.calls.some(([kind, value]) => kind === 'still' && value === .5)), true);

    assert.equal(await page.evaluate(() => {
      const root = document.querySelector('#one > section');
      return root.scrollWidth <= root.clientWidth;
    }), true, 'controls must not overflow at a 390px viewport');
    await page.evaluate(() => {
      const test = window.controlsTest;
      const stale = document.querySelector('#one input[name=enabled]');
      test.a.dispose(); test.a.dispose(); test.a.refresh();
      const before = test.calls.length;
      stale.dispatchEvent(new Event('change'));
      if (test.calls.length !== before) throw new Error('Disposed input retained its handler');
    });
    assert.equal(await one.locator('*').count(), 0);
    assert.equal(await page.locator('#two').getByRole('heading').count(), 1);
    await page.locator('#two').getByRole('button', { name: 'Reverse now', exact: true }).click();
    await page.evaluate(() => window.controlsTest.b.dispose());
    assert.equal(await page.locator('#two > *').count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
