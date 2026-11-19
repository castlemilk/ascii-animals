import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { finalizeExport, legacyManifestName } from '../scripts/finalize-export.mjs';
import { createExportServer } from '../scripts/serve-export.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ascii-demo-export-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const legacyDir = path.join(root, 'dist'), outputDir = path.join(root, 'out');
  await mkdir(path.join(legacyDir, 'fox'), { recursive: true });
  await mkdir(path.join(outputDir, 'animals', 'fox'), { recursive: true });
  await writeFile(path.join(legacyDir, 'index.html'), 'old catalogue');
  await writeFile(path.join(legacyDir, 'fox', 'index.html'), '<h1>Original fox</h1>');
  await writeFile(path.join(legacyDir, 'poster.png'), Buffer.from([0, 1, 255, 128, 13, 10]));
  await writeFile(path.join(outputDir, 'index.html'), '<h1>New catalogue</h1>');
  await writeFile(path.join(outputDir, 'animals', 'fox', 'index.html'), '<h1>Fox</h1>');
  return { root, legacyDir, outputDir };
}

test('retained studios preserve binary bytes and leave the Next catalogue intact', async t => {
  const options = await fixture(t);
  const result = await finalizeExport(options);
  assert.equal(result.retainedFiles, 2);
  assert.equal(await readFile(path.join(options.outputDir, 'index.html'), 'utf8'), '<h1>New catalogue</h1>');
  assert.deepEqual(await readFile(path.join(options.outputDir, 'poster.png')), await readFile(path.join(options.legacyDir, 'poster.png')));
  const manifest = JSON.parse(await readFile(path.join(options.outputDir, legacyManifestName), 'utf8'));
  assert.deepEqual(manifest.files.map(file => file.path), ['fox/index.html', 'poster.png']);
  assert.equal(await readFile(path.join(options.outputDir, '.nojekyll'), 'utf8'), '');
});

test('route collisions fail before copying or overwriting any legacy asset', async t => {
  const options = await fixture(t);
  await mkdir(path.join(options.outputDir, 'fox'));
  await writeFile(path.join(options.outputDir, 'fox', 'index.html'), 'A future Next route');
  await assert.rejects(finalizeExport(options), /Refusing to overwrite.*fox\/index\.html/);
  assert.equal(await readFile(path.join(options.outputDir, 'fox', 'index.html'), 'utf8'), 'A future Next route');
  await assert.rejects(readFile(path.join(options.outputDir, 'poster.png')), { code: 'ENOENT' });
});

test('legacy symlinks cannot export files outside the inspected tree', async t => {
  const options = await fixture(t);
  await writeFile(path.join(options.root, 'outside.txt'), 'outside');
  await symlink(path.join(options.root, 'outside.txt'), path.join(options.legacyDir, 'unsafe.txt'));
  await assert.rejects(finalizeExport(options), /Symbolic links are not exported/);
  await assert.rejects(readFile(path.join(options.outputDir, 'poster.png')), { code: 'ENOENT' });
});

test('static host serves refreshable directory URLs only below the Pages mount', async t => {
  const options = await fixture(t);
  await finalizeExport(options);
  const server = createExportServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/ascii-animals/animals/fox/', '/ascii-animals/animals/fox/index.html', '/ascii-animals/fox/index.html?keep=yes']) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /[Ff]ox/);
  }
  const redirect = await fetch(origin + '/ascii-animals/animals/fox?keep=yes', { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/ascii-animals/animals/fox/?keep=yes');
  for (const route of ['/', '/animals/fox/', '/ascii-animals/missing/', '/ascii-animals/missing.js']) assert.equal((await fetch(origin + route)).status, 404, route);
  const head = await fetch(origin + '/ascii-animals/animals/fox/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert(Number(head.headers.get('content-length')) > 0);
  assert.equal((await fetch(origin + '/ascii-animals/', { method: 'POST' })).status, 405);
  await writeFile(path.join(options.outputDir, '404.html'), '<h1>Study not found</h1>');
  const missing = await fetch(origin + '/ascii-animals/not-a-study/');
  assert.equal(missing.status, 404, 'A custom 404 must never become a successful SPA fallback');
  assert.equal(await missing.text(), '<h1>Study not found</h1>');
});
