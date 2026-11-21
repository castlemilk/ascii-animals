import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkSeo, seoPages } from '../scripts/check-seo.mjs';
import { basePath, exportRoot } from '../scripts/finalize-export.mjs';

test('the actual static export satisfies the SEO contract before JavaScript', async () => {
  assert.equal((await checkSeo()).seoPagesChecked, 14);
});

// Mutate a small copy of the real build, never the served export or renderer assets.
async function fixture(t) {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'ascii-seo-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const files = new Set([...seoPages.map(page => page.file), '404.html', 'sitemap.xml']);
  for (const page of seoPages) {
    const html = await readFile(path.join(exportRoot, page.file), 'utf8');
    for (const match of html.matchAll(/<meta\s+property="og:image"\s+content="([^"]+)"/g)) {
      files.add(new URL(match[1]).pathname.slice(basePath.length + 1));
    }
  }
  for (const file of files) {
    await mkdir(path.dirname(path.join(outputDir, file)), { recursive: true });
    await cp(path.join(exportRoot, file), path.join(outputDir, file));
  }
  const edit = async (file, transform) => {
    const target = path.join(outputDir, file);
    const before = await readFile(target, 'utf8'), after = transform(before);
    assert.notEqual(after, before, `Mutation did not exercise ${file}`);
    await writeFile(target, after);
  };
  return { outputDir, edit };
}

const canonicalTag = /<link\b[^>]*rel="canonical"[^>]*\/?\s*>/;
for (const [name, transform, error] of [
  ['a missing canonical, even when one is serialized in a script', html => html.replace(canonicalTag, '').replace('</head>', '<script>"<link rel=\"canonical\" href=\"https://castlemilk.github.io/ascii-animals/animals/manta/\">"</script></head>'), /canonical: expected exactly one/],
  ['duplicate canonicals', html => html.replace(canonicalTag, '$&$&'), /canonical: expected exactly one/],
  ['the catalogue canonical inherited by a species', html => html.replace(canonicalTag, '<link rel="canonical" href="https://castlemilk.github.io/ascii-animals/">'), /absolute clean production URL/],
  ['an extra Pages prefix', html => html.replace(canonicalTag, '<link rel="canonical" href="https://castlemilk.github.io/ascii-animals/ascii-animals/animals/manta/">'), /absolute clean production URL/],
  ['a query canonical', html => html.replace(canonicalTag, '<link rel="canonical" href="https://castlemilk.github.io/ascii-animals/animals/manta/?variant=alternate">'), /absolute clean production URL/],
  ['noindex on a valid species', html => html.replace('</head>', '<meta name="robots" content="noindex"></head>'), /restrictive robots/],
  ['an OG URL that disagrees with the canonical', html => html.replace(/(<meta property="og:url" content=")[^"]+/, '$1https://castlemilk.github.io/ascii-animals/'), /OG URL must match canonical/],
  ['incorrect social image dimensions', html => html.replace(/(<meta property="og:image:width" content=")[^"]+/, '$1600'), /Expected values to be strictly equal/],
]) {
  test(`export check rejects ${name}`, async t => {
    const { outputDir, edit } = await fixture(t);
    await edit('animals/manta/index.html', transform);
    await assert.rejects(checkSeo({ outputDir }), error);
  });
}

test('export check rejects a 404 canonical and unwanted sitemap URLs', async t => {
  const { outputDir, edit } = await fixture(t);
  await edit('404.html', html => html.replace('</head>', '<link rel="canonical" href="https://castlemilk.github.io/ascii-animals/"></head>'));
  await assert.rejects(checkSeo({ outputDir }), /404.html must not inherit/);
  await cp(path.join(exportRoot, '404.html'), path.join(outputDir, '404.html'));
  await edit('sitemap.xml', xml => xml.replace('</urlset>', '<url><loc>https://castlemilk.github.io/ascii-animals/animals.html?species=manta</loc></url></urlset>'));
  await assert.rejects(checkSeo({ outputDir }), /only the 14 preferred/);
});
