import { test, expect, type Page } from '@playwright/test';

const base = '/ascii-animals';
const production = 'https://castlemilk.github.io';

async function canonical(page: Page, route: string) {
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', production + route);
  await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute('content', production + route);
}

test('static query and index.html aliases keep the clean canonical; invalid routes stay 404', async ({ request }) => {
  for (const [route, preferred] of [
    [`${base}/?q=fox&habitat=Land`, `${base}/`],
    [`${base}/index.html?utm_source=review`, `${base}/`],
    // An inert query is not a claim that a variant feature has shipped.
    [`${base}/animals/manta/?variant=alternate&utm_source=review`, `${base}/animals/manta/`],
    [`${base}/animals/manta/index.html?keep=yes`, `${base}/animals/manta/`],
  ]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex|none/i);
    const html = await response.text();
    const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/)?.[1] ?? '';
    const links = head.match(/<link\b[^>]*rel="canonical"[^>]*>/g) ?? [];
    expect(links, route).toHaveLength(1);
    expect(links[0]?.match(/href="([^"]+)"/)?.[1], route).toBe(production + preferred);
  }
  const redirect = await request.get(`${base}/animals/manta?keep=yes`, { maxRedirects: 0 });
  expect([301, 308]).toContain(redirect.status());
  expect(redirect.headers().location).toBe(`${base}/animals/manta/?keep=yes`);
  const missing = await request.get(`${base}/animals/not-a-species/`);
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toMatch(/name="robots" content="noindex"/);
  expect(await missing.text()).not.toMatch(/<link\b[^>]*rel="canonical"/);
  expect((await request.get('/animals/manta/')).status()).toBe(404);
  const sitemap = await request.get(`${base}/sitemap.xml`);
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toMatch(/xml/);
  const home = await (await request.get(`${base}/`)).text();
  const imageUrl = home.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  expect(imageUrl).toBeTruthy();
  const image = await request.get(new URL(imageUrl!).pathname);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/png');
  expect((await image.body()).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
});

test('catalogue filtering changes the URL without changing canonical metadata', async ({ page }) => {
  await page.goto(`${base}/?q=fox&habitat=Land#catalogue`);
  await expect(page.getByRole('searchbox', { name: 'Find an animal' })).toHaveValue('fox');
  await expect(page.locator('#catalogue .study-link')).toHaveCount(1);
  await canonical(page, `${base}/`);
  await page.getByRole('searchbox', { name: 'Find an animal' }).fill('frog');
  expect(new URL(page.url()).searchParams.get('q')).toBe('frog');
  await canonical(page, `${base}/`);
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.locator('#catalogue .study-link')).toHaveCount(13);
  await canonical(page, `${base}/`);
});

test('deep link, interaction, breadcrumb, Back and refresh keep route metadata synchronized', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).pathname.startsWith(`${base}/`)) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(`${base}/animals/manta/?utm_source=review`);
  await expect(page.getByTestId('renderer-host')).toHaveAttribute('data-status', 'ready');
  await canonical(page, `${base}/animals/manta/`);
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await expect(page.getByTestId('renderer-host')).toHaveAttribute('data-paused', 'true');
  await page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).getByRole('link', { name: 'Catalogue', exact: true }).click();
  await canonical(page, `${base}/`);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Manta ray', level: 1, exact: true })).toBeVisible();
  await canonical(page, `${base}/animals/manta/`);
  expect((await page.reload())?.status()).toBe(200);
  await canonical(page, `${base}/animals/manta/`);
  expect(errors).toEqual([]);
});

test.describe('crawler-visible content without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('plain links discover all species and retain page-scoped metadata on direct load', async ({ page }) => {
    await page.goto(`${base}/?q=fox&habitat=Land`);
    await expect(page.locator('#catalogue .study-link')).toHaveCount(13);
    await canonical(page, `${base}/`);
    await page.getByRole('link', { name: 'Open Manta ray study', exact: true }).click();
    await canonical(page, `${base}/animals/manta/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Manta ray', exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).getByRole('link', { name: 'Catalogue', exact: true }).click();
    await canonical(page, `${base}/`);
  });
});
