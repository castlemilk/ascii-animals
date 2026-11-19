import { test, expect } from '@playwright/test';

const base = '/ascii-animals';
const legacyPages = [
  'cuttlefish-demo.html', 'animals.html', 'cuttlefish.html', 'animals-standalone.html', 'record.html', 'cuttlefish-study.html', 'manta-reef.html', 'octopus-den.html',
  ...['seahorse', 'crab', 'turtle', 'pufferfish', 'frog', 'butterfly', 'dragonfly', 'gecko', 'owl', 'fox'].map(slug => `${slug}/index.html`),
];

test('canonical, legacy, directory and download URLs remain actual static files', async ({ request }) => {
  for (const slug of ['cuttlefish', 'manta', 'octopus', 'seahorse', 'crab', 'turtle', 'pufferfish', 'frog', 'butterfly', 'dragonfly', 'gecko', 'owl', 'fox']) {
    for (let visit = 0; visit < 2; visit++) {
      const response = await request.get(`${base}/animals/${slug}/`);
      expect(response.status(), `${slug} request ${visit + 1}`).toBe(200);
      expect(await response.text()).toContain(`data-species="${slug}"`);
    }
  }
  for (const route of legacyPages) {
    const response = await request.get(`${base}/${route}`);
    expect(response.status(), route).toBe(200);
    expect(response.headers()['content-type'], route).toContain('text/html');
  }
  for (const slug of ['seahorse', 'crab', 'turtle', 'pufferfish', 'frog', 'butterfly', 'dragonfly', 'gecko', 'owl', 'fox']) {
    expect((await request.get(`${base}/${slug}/`)).status(), slug).toBe(200);
  }
  expect((await request.get(`${base}/animals/unknown/`)).status()).toBe(404);
  expect((await request.get('/animals/fox/')).status()).toBe(404);
});

for (const [slug, scene] of [['manta', 'Upwelling ballet'], ['octopus', 'Tidepool investigation'], ['cuttlefish', 'Reef rendezvous']] as const) {
  test(`original marine query selects ${slug}, retains its fragment and survives refresh`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = `${base}/animals.html?species=${slug}#animal-controls`;
    expect((await page.goto(url))?.status()).toBe(200);
    await expect(page.locator('#animal-title')).toHaveText(scene);
    await expect(page.locator('#count')).toHaveValue('1');
    await expect(page.locator('#species-0')).toHaveValue(slug);
    expect(new URL(page.url()).hash).toBe('#animal-controls');
    expect((await page.reload())?.status()).toBe(200);
    await expect(page.locator('#species-0')).toHaveValue(slug);
    expect(errors).toEqual([]);
  });
}

test('unknown legacy marine queries preserve their safe mixed-cast fallback', async ({ page }) => {
  await page.goto(`${base}/animals.html?species=__proto__`);
  await expect(page.locator('#animal-title')).toHaveText('Reef rendezvous');
  await expect(page.locator('#count')).toHaveValue('3');
});

test('original Cuttlefish anchors and catalogue return remain functional', async ({ page }) => {
  await page.goto(`${base}/cuttlefish-demo.html#under-the-surface`);
  await expect(page.locator('#under-the-surface')).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#under-the-surface');
  await page.getByRole('link', { name: 'ASCII Animals catalogue', exact: true }).click();
  await expect(page.locator('#catalogue')).toBeVisible();
  await expect(page.locator('#catalogue a[href*="/animals/"]')).toHaveCount(13);
});

for (const [species, title, legacy] of [
  ['cuttlefish', 'Cuttlefish Field Study', 'cuttlefish-study.html'],
  ['manta', 'Manta Reef Glide', 'manta-reef.html'],
  ['octopus', 'Octopus Den', 'octopus-den.html'],
] as const) {
  test(`canonical ${species} keeps its authored study discoverable`, async ({ page, request }) => {
    await page.goto(`${base}/animals/${species}/`);
    const link = page.getByRole('link', { name: title, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', `${base}/${legacy}`);
    expect((await request.get(`${base}/${legacy}`)).status()).toBe(200);
  });
}
