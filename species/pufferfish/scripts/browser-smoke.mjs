#!/usr/bin/env node
/** Optional real-browser acceptance. Requires an existing Playwright/Chromium install.
 * The authoring environment failed before page creation; this scenario is UNRUN here.
 * Serve the repository root separately; no deployment is performed by this script.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.PUFFERFISH_DEMO_URL ?? 'http://127.0.0.1:8000/species/pufferfish/';
const browser = await chromium.launch(process.env.PUFFERFISH_CHROMIUM ? { executablePath: process.env.PUFFERFISH_CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base); await page.waitForSelector('#phase');
  assert.equal(await page.locator('#fallback').isVisible(), false);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Approach gently' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Refresh text frame' }).evaluate(button => button.closest('details').open = true);
  await page.getByRole('button', { name: 'Refresh text frame' }).click();
  const held = await page.locator('#text-frame').textContent();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Refresh text frame' }).click();
  assert.equal(await page.locator('#text-frame').textContent(), held);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Resume', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Approach gently' }).click();
  assert.equal(await page.locator('#motion-label').textContent(), 'STILL WATERS');
  await page.getByRole('button', { name: 'Give some space' }).click();
  await page.locator('#view').selectOption('front');
  assert.equal(await page.locator('#phase').textContent(), 'Calm waters');
  await page.screenshot({ path: process.env.PUFFERFISH_BROWSER_SCREENSHOT ?? '/tmp/pufferfish-browser-smoke.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole('button', { name: 'Approach gently' }).click();
  assert.equal(await page.locator('#motion-label').textContent(), 'STILL WATERS');
  assert.deepEqual(errors, []);
  console.log('Browser DOM/keyboard/static scenario passed. Physical touch, screen readers, heap and device profiling remain separate.');
} finally { await browser.close(); }
