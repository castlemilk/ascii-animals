import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { basePath, exportRoot } from './finalize-export.mjs';

// This acceptance list is deliberately independent of metadata generation.
const animals = [
  ['cuttlefish', 'Cuttlefish'], ['manta', 'Manta ray'], ['octopus', 'Octopus'],
  ['seahorse', 'Seahorse'], ['crab', 'Crab'], ['turtle', 'Sea turtle'],
  ['pufferfish', 'Pufferfish'], ['frog', 'Frog'], ['butterfly', 'Butterfly'],
  ['dragonfly', 'Dragonfly'], ['gecko', 'Gecko'], ['owl', 'Owl'], ['fox', 'Fox'],
];
export const productionOrigin = 'https://castlemilk.github.io';
export const seoPages = [
  { file: 'index.html', route: `${basePath}/`, name: null },
  ...animals.map(([slug, name]) => ({ file: `animals/${slug}/index.html`, route: `${basePath}/animals/${slug}/`, name })),
];

const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&apos;|&#39;/g, "'").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)));
const markup = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
const text = value => decode(value.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
function elements(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'gi'))].map(match => {
    const attributes = {};
    for (const attr of match[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes[attr[1].toLowerCase()] = decode(attr[2] ?? attr[3]);
    return attributes;
  });
}
function one(values, label) {
  assert.equal(values.length, 1, `${label}: expected exactly one, found ${values.length}`);
  assert(values[0]?.trim(), `${label}: must not be empty`);
  return values[0];
}
function canonicalLinks(html) {
  return elements(html, 'link').filter(tag => tag.rel?.toLowerCase().split(/\s+/).includes('canonical')).map(tag => tag.href);
}

/** Inspect the actual static files, without executing client code or counting RSC strings as HTML. */
export async function checkSeo({ outputDir = exportRoot } = {}) {
  const unique = { title: new Set(), description: new Set(), h1: new Set() };
  const images = new Set();
  for (const page of seoPages) {
    const html = markup(await readFile(path.join(outputDir, page.file), 'utf8'));
    const head = one([...html.matchAll(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/gi)].map(match => match[1]), `${page.file} head`);
    const canonical = productionOrigin + page.route;
    assert.equal(one(canonicalLinks(html), `${page.file} canonical`), canonical, `${page.file}: canonical must be the absolute clean production URL`);
    assert.equal(one(canonicalLinks(head), `${page.file} head canonical`), canonical);
    const metadata = elements(head, 'meta');
    const meta = (attribute, key) => one(metadata.filter(tag => tag[attribute]?.toLowerCase() === key).map(tag => tag.content), `${page.file} ${key}`);
    const title = one([...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)].map(match => text(match[1])), `${page.file} title`);
    const description = meta('name', 'description');
    const h1 = one([...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)].map(match => text(match[1])), `${page.file} h1`);
    assert.match(title, /ASCII/i, `${page.file}: title must identify ASCII art`);
    if (page.name) {
      assert(title.toLowerCase().includes(page.name.toLowerCase()), `${page.file}: species-specific title`);
      assert.equal(h1.replace(/\.$/, ''), page.name, `${page.file}: species-specific H1`);
    }
    for (const [key, value] of Object.entries({ title, description, h1 })) {
      assert(!unique[key].has(value), `${page.file}: duplicate ${key}`);
      unique[key].add(value);
    }
    for (const tag of metadata.filter(tag => ['robots', 'googlebot', 'bingbot'].includes(tag.name?.toLowerCase()))) {
      assert(!/\b(?:noindex|nofollow|none)\b/i.test(tag.content ?? ''), `${page.file}: indexable page has restrictive robots metadata`);
    }
    assert.equal(meta('property', 'og:type'), 'website');
    assert.equal(meta('property', 'og:site_name'), 'ASCII Animals');
    assert.equal(meta('property', 'og:url'), canonical, `${page.file}: OG URL must match canonical`);
    assert.equal(meta('property', 'og:title'), title, `${page.file}: OG title`);
    assert.equal(meta('property', 'og:description'), description, `${page.file}: OG description`);
    assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
    assert.equal(meta('name', 'twitter:title'), title, `${page.file}: Twitter title`);
    assert.equal(meta('name', 'twitter:description'), description, `${page.file}: Twitter description`);
    const image = new URL(meta('property', 'og:image'));
    assert.equal(image.origin, productionOrigin, `${page.file}: social image origin`);
    assert(image.pathname.startsWith(`${basePath}/`) && !image.pathname.slice(basePath.length).includes(basePath), `${page.file}: social image Pages base path`);
    assert.equal(image.search + image.hash, '', `${page.file}: social image URL must be stable`);
    assert.equal(meta('property', 'og:image:type'), 'image/png');
    assert.equal(meta('name', 'twitter:image'), image.href);
    assert.equal(meta('name', 'twitter:image:alt'), meta('property', 'og:image:alt'));
    const relative = decodeURIComponent(image.pathname.slice(basePath.length + 1));
    assert(!relative.split('/').includes('..') && relative.endsWith('.png'), `${page.file}: social image must be an exported PNG`);
    const bytes = await readFile(path.join(outputDir, relative));
    assert(bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR', `${page.file}: invalid PNG signature/header`);
    assert.equal(bytes.readUInt32BE(16), 1200, `${page.file}: social image width`);
    assert.equal(bytes.readUInt32BE(20), 630, `${page.file}: social image height`);
    assert.equal(meta('property', 'og:image:width'), String(bytes.readUInt32BE(16)));
    assert.equal(meta('property', 'og:image:height'), String(bytes.readUInt32BE(20)));
    images.add(relative);

    const breadcrumb = one([...html.matchAll(/<nav\b(?=[^>]*aria-label=["']Breadcrumb["'])[^>]*>([\s\S]*?)<\/nav\s*>/gi)].map(match => match[1]), `${page.file} breadcrumb`);
    const breadcrumbLinks = elements(breadcrumb, 'a').map(tag => tag.href);
    assert(breadcrumbLinks.includes(`${basePath}/`), `${page.file}: missing plain home breadcrumb link`);
    if (page.name) assert(breadcrumbLinks.includes(`${basePath}/#catalogue`), `${page.file}: missing plain catalogue breadcrumb link`);
    else {
      const links = elements(html, 'a').map(tag => tag.href);
      for (const animal of seoPages.slice(1)) assert(links.includes(animal.route), `index.html: missing plain species link ${animal.route}`);
    }
  }

  const notFound = markup(await readFile(path.join(outputDir, '404.html'), 'utf8'));
  assert.equal(canonicalLinks(notFound).length, 0, '404.html must not inherit a catalogue/species canonical');
  assert(elements(notFound, 'meta').some(tag => tag.name?.toLowerCase() === 'robots' && /\bnoindex\b/i.test(tag.content ?? '')), '404.html must remain noindex');
  assert.equal(elements(notFound, 'meta').filter(tag => tag.property === 'og:url').length, 0, '404.html must not inherit a valid-page OG URL');

  const sitemap = await readFile(path.join(outputDir, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<urlset\s[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]));
  assert.equal(new Set(urls).size, urls.length, 'Sitemap must not repeat URLs');
  assert.deepEqual([...urls].sort(), seoPages.map(page => productionOrigin + page.route).sort(), 'Sitemap must contain only the 14 preferred catalogue/species URLs');
  assert(!/<lastmod\b/.test(sitemap), 'Do not invent modification times for unchanged static content');
  return { seoPagesChecked: seoPages.length, cleanCanonicalUrls: unique.title.size, socialImagesChecked: images.size, sitemapUrlsChecked: urls.length, notFoundCanonical: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await checkSeo(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
