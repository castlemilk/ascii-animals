import { test, expect, type Page } from '@playwright/test';

const base = '/ascii-animals';
const animals = [
  ['cuttlefish', 'Cuttlefish'], ['manta', 'Manta ray'], ['octopus', 'Octopus'],
  ['seahorse', 'Seahorse'], ['crab', 'Crab'], ['turtle', 'Sea turtle'],
  ['pufferfish', 'Pufferfish'], ['frog', 'Frog'], ['butterfly', 'Butterfly'],
  ['dragonfly', 'Dragonfly'], ['gecko', 'Gecko'], ['owl', 'Owl'], ['fox', 'Fox'],
] as const;

async function ready(page: Page, slug: string, name: string) {
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
  const host = page.getByTestId('renderer-host');
  await expect(host).toHaveCount(1);
  await expect(host).toHaveAttribute('data-species', slug);
  await expect(host).toHaveAttribute('data-status', 'ready');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).locator('[aria-current="page"]')).toHaveText(name);
  const rail = page.locator('nav[aria-label="Animals"]');
  if (await rail.isVisible()) await expect(rail.locator('[aria-current="page"]')).toHaveAccessibleName(name);
  else await expect(page.getByRole('combobox', { name: 'Choose an animal', exact: true })).toHaveValue(slug);
  return host;
}

for (const [slug, name] of animals) {
  test(`direct load and refresh render ${name} from the static export`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && response.url().includes('/_next/')) errors.push(`${response.status()} ${response.url()}`); });
    const response = await page.goto(`${base}/animals/${slug}/`);
    expect(response?.status()).toBe(200);
    const host = await ready(page, slug, name);
    await expect(host.locator('canvas')).toHaveCount(slug === 'owl' ? 0 : 1);
    expect((await page.reload())?.status()).toBe(200);
    await ready(page, slug, name);
    expect(errors).toEqual([]);
  });
}

test('keyboard navigation has a skip link, visible focus, breadcrumbs, finite previous/next and catalogue return', async ({ page }) => {
  await page.goto(`${base}/`);
  await expect(page.locator('canvas')).toHaveCount(0);
  const skip = page.getByRole('link', { name: /skip/i }).first();
  await expect(skip).toHaveCSS('clip-path', 'inset(50%)');
  await expect(skip).toHaveCSS('pointer-events', 'none');
  await page.keyboard.press('Tab');
  await expect(skip).toHaveCSS('clip-path', 'none');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  const skipTarget = await skip.getAttribute('href');
  await page.keyboard.press('Enter');
  expect(new URL(page.url()).hash).toBe(skipTarget);

  const foxLink = page.locator(`#catalogue a[href="${base}/animals/fox/"]`).first();
  await foxLink.focus();
  const focusStyle = await foxLink.evaluate(element => ({ outline: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth }));
  expect(focusStyle.outline).not.toBe('none');
  expect(parseFloat(focusStyle.width)).toBeGreaterThan(0);
  await page.keyboard.press('Enter');
  await ready(page, 'fox', 'Fox');
  await expect(page.getByRole('heading', { level: 1, name: 'Fox', exact: true })).toBeFocused();
  await expect(page.getByRole('link', { name: /^Next:/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Previous: Owl', exact: true }).click();
  await ready(page, 'owl', 'Owl');
  await expect(page.getByRole('heading', { level: 1, name: 'Owl', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Back to catalogue', exact: true }).click();
  await expect(page).toHaveURL(`${base}/#catalogue`);
  await expect(page.locator('#catalogue')).toBeFocused();
  await expect(page.getByTestId('renderer-host')).toHaveCount(0);
  await page.goBack();
  await ready(page, 'owl', 'Owl');
  await expect(page.getByRole('heading', { level: 1, name: 'Owl', exact: true })).toBeFocused();

  await page.getByRole('navigation', { name: 'Animals', exact: true }).getByRole('link', { name: 'Cuttlefish', exact: true }).click();
  await ready(page, 'cuttlefish', 'Cuttlefish');
  await expect(page.getByRole('link', { name: /^Previous:/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Next: Manta ray', exact: true })).toBeVisible();
});

test('catalogue search, habitat filtering and reset keep navigation understandable', async ({ page }) => {
  await page.goto(`${base}/#catalogue`);
  await page.getByRole('searchbox', { name: 'Find an animal', exact: true }).fill('fox');
  await expect(page.locator(`#catalogue a[href="${base}/animals/fox/"]`)).toBeVisible();
  await expect(page.locator(`#catalogue a[href="${base}/animals/cuttlefish/"]`)).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Find an animal', exact: true }).fill('no such animal');
  await expect(page.locator('#catalogue [role="status"]')).toContainText('0 animals');
  await expect(page.getByRole('heading', { name: 'No animals found.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.locator('#catalogue a[href*="/animals/"]')).toHaveCount(13);
  const habitat = page.getByRole('combobox', { name: 'Habitat', exact: true });
  const optionValue = await habitat.locator('option').nth(1).getAttribute('value');
  expect(optionValue).toBeTruthy();
  await habitat.selectOption(optionValue!);
  const filteredCount = await page.locator('#catalogue a[href*="/animals/"]').count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThan(13);
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.locator('#catalogue a[href*="/animals/"]')).toHaveCount(13);
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('catalogue and study reflow, with accessible species navigation and control targets', async ({ page }) => {
    await page.goto(`${base}/`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator(`#catalogue a[href="${base}/animals/frog/"]`).first().tap();
    await ready(page, 'frog', 'Frog');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const navigation = page.getByRole('combobox', { name: 'Choose an animal', exact: true });
    await expect(navigation).toBeVisible();
    await expect(navigation).toHaveValue('frog');
    await navigation.selectOption('butterfly');
    await expect(page).toHaveURL(`${base}/animals/frog/`);
    await expect(page.getByTestId('renderer-host')).toHaveAttribute('data-species', 'frog');
    await page.getByRole('button', { name: 'Open selected study', exact: true }).tap();
    await ready(page, 'butterfly', 'Butterfly');
    const next = page.getByRole('link', { name: 'Next: Dragonfly', exact: true });
    await next.scrollIntoViewIfNeeded();
    const box = await next.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(40);
    await next.tap();
    await ready(page, 'dragonfly', 'Dragonfly');
    await page.getByRole('link', { name: 'Back to catalogue', exact: true }).tap();
    await expect(page.locator('#catalogue')).toBeVisible();
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('catalogue and species pages retain real links and a readable still-state explanation', async ({ page }) => {
    expect((await page.goto(`${base}/animals/fox/`))?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Fox', exact: true })).toBeVisible();
    await expect(page.locator('.no-script')).toContainText(/JavaScript/i);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to catalogue', exact: true }).click();
    await expect(page.locator('#catalogue a[href*="/animals/"]')).toHaveCount(13);
  });
  test('mobile species navigation remains usable through plain links', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`${base}/animals/cuttlefish/`);
    await expect(page.getByRole('combobox', { name: 'Choose an animal', exact: true })).toHaveCount(0);
    const navigation = page.getByRole('navigation', { name: 'Animals without JavaScript', exact: true });
    await expect(navigation).toBeVisible();
    await navigation.getByRole('link', { name: 'Fox', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Fox', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
