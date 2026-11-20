import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const demoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const legacyRoot = path.resolve(demoRoot, '../dist');
export const exportRoot = path.join(demoRoot, 'out');
export const basePath = '/ascii-animals';
export const legacyManifestName = 'legacy-manifest.json';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function filesBelow(directory, prefix = '') {
  const files = [];
  for (const entry of (await readdir(path.join(directory, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not exported: ${relative}`);
    if (entry.isDirectory()) files.push(...await filesBelow(directory, relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unsupported file type in static export: ${relative}`);
  }
  return files;
}

async function exists(file) {
  try { await lstat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

/**
 * Retain the existing studios at their existing URLs. The Next application
 * never imports these bundles; its renderer adapters consume the built package.
 * The only replaced legacy page is the root catalogue (Next's index.html).
 * Refuse collisions before copying, so a future route cannot silently replace
 * either a Next route or an existing studio. Run after a fresh `next build`.
 */
export async function finalizeExport({ legacyDir = legacyRoot, outputDir = exportRoot } = {}) {
  await readFile(path.join(outputDir, 'index.html'));
  await readFile(path.join(legacyDir, 'index.html'));
  const relativeFiles = (await filesBelow(legacyDir)).filter(file => file !== 'index.html');
  const destinations = [...relativeFiles, legacyManifestName, '.nojekyll'];
  for (const relative of destinations) {
    if (await exists(path.join(outputDir, relative))) {
      throw new Error(`Refusing to overwrite an exported path: ${relative}. Rebuild Next into a clean out directory; resolve route collisions explicitly.`);
    }
    const segments = relative.split('/');
    for (let index = 1; index < segments.length; index++) {
      const ancestor = path.join(outputDir, ...segments.slice(0, index));
      if (await exists(ancestor)) {
        const metadata = await lstat(ancestor);
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`Unsafe exported parent path: ${segments.slice(0, index).join('/')}`);
      }
    }
  }

  const files = [];
  for (const relative of relativeFiles) {
    const source = path.join(legacyDir, relative);
    const destination = path.join(outputDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination, constants.COPYFILE_EXCL);
    const [before, after] = await Promise.all([readFile(source), readFile(destination)]);
    if (!before.equals(after)) throw new Error(`Legacy asset changed during export: ${relative}`);
    files.push({ path: relative, bytes: after.length, sha256: sha256(after) });
  }
  const manifest = {
    schema: 'ascii-animals/legacy-preservation/v1',
    basePath,
    policy: 'Original dist files are retained byte-for-byte, except index.html, which is the Next.js catalogue.',
    files,
  };
  await writeFile(path.join(outputDir, legacyManifestName), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  await writeFile(path.join(outputDir, '.nojekyll'), '', { flag: 'wx' });
  return { retainedFiles: files.length, retainedBytes: files.reduce((sum, file) => sum + file.bytes, 0), outputDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await finalizeExport(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
