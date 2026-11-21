import assert from 'node:assert/strict';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { basePath, demoRoot, exportRoot, filesBelow, legacyManifestName, legacyRoot, sha256 } from './finalize-export.mjs';
import { checkSeo } from './check-seo.mjs';

export const species = ['cuttlefish', 'manta', 'octopus', 'seahorse', 'crab', 'turtle', 'pufferfish', 'frog', 'butterfly', 'dragonfly', 'gecko', 'owl', 'fox'];

const decodeEntities = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)));
function tags(html) {
  const clean = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>').replace(/(<style\b[^>]*>)[\s\S]*?<\/style>/gi, '$1</style>');
  return [...clean.matchAll(/<([a-z][a-z\d-]*)\b([^>]*)>/gi)].map(match => {
    const attributes = {};
    for (const attr of match[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes[attr[1]] = decodeEntities(attr[2] ?? attr[3]);
    return { name: match[1].toLowerCase(), attributes };
  });
}

const packageFactories = {
  'ascii-animals-review/movement/marine': 'createMarineMovementArtwork',
  'ascii-animals-review/fox': 'createFoxArtwork',
  'ascii-animals-review/dragonfly': 'createDragonflyArtwork',
  'ascii-animals-review/gecko': 'createGeckoArtwork',
  'ascii-animals-review/pufferfish': 'createPufferfishArtwork',
  'ascii-animals-review/frog': 'createFrogArtwork',
  'ascii-animals-review/owl': 'createOwlArtwork',
  'ascii-animals-review/seahorse': 'createSeahorseArtwork',
  'ascii-animals-review/crab': 'createCrabArtwork',
  'ascii-animals-review/turtle': 'createTurtleArtwork',
  'ascii-animals-review/butterfly': 'createButterflyArtwork',
};

const localVariation = '../../../species/octopus/trickster/browser.mjs';
const localVariationFactory = 'createOctopusTrickster';
const puppetAdapter = './ink-puppet.mjs';
const puppetFactory = 'createInkPuppetVariant';
const curmudgeonEntry = '../../../species/pufferfish/build/character.js';
const curmudgeonFactory = 'mountPufferfishCharacter';
const privateStudies = new Map([
  ['../../.private-renderers/src/public/crab/variants/tidepool-trouper.js', ['mountTrouper', 'createTidepoolTrouperArtwork']],
  ['../../.private-renderers/species/butterfly/variations/sunpatch/index.js', ['mountSunpatch', 'createSunpatchButterflyArtwork']],
]);

/**
 * Structural build evidence, not a browser execution claim: inspect TypeScript
 * imports, actual installed package export resolution and Webpack's emitted
 * factory exports. A renderer entry must not appear in an initially included or
 * preloaded script. Marine intentionally shares one entry; its private engine
 * is also a dependency of Pufferfish, as documented by the package.
 */
export async function checkConsumerImports({ outputDir = exportRoot, appDir = demoRoot, htmlTags } = {}) {
  const sourceRoot = path.join(appDir, 'src');
  const dynamicSpecifiers = new Set();
  let eagerPackageImports = 0;
  let lazyVariationImports = 0;
  let lazyPuppetImports = 0;
  let lazyCurmudgeonImports = 0;
  const lazyPrivateStudies = new Map();
  for (const relative of (await filesBelow(sourceRoot)).filter(file => /\.tsx?$/.test(file))) {
    const filename = path.join(sourceRoot, relative);
    const parsed = ts.createSourceFile(filename, await readFile(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    const inspect = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        if (specifier.startsWith('ascii-animals-review')) {
          const typeOnly = ts.isImportDeclaration(node)
            ? node.importClause?.isTypeOnly || (node.importClause && !node.importClause.name && node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.length > 0 && node.importClause.namedBindings.elements.every(element => element.isTypeOnly))
            : node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every(element => element.isTypeOnly));
          if (!typeOnly) eagerPackageImports++;
          assert(typeOnly, `Eager renderer package import in ${relative}: ${specifier}`);
        }
        assert(!specifier.includes('/.private-renderers/'), `Eager private study import: ${relative}`);
        if (specifier === puppetAdapter || /(?:^|\/)ink-puppet\/(?:browser|page)\.mjs$/.test(specifier)) {
          assert(ts.isImportDeclaration(node) && node.importClause?.isTypeOnly,
            `Eager Ink Puppet adapter or renderer import: ${relative}`);
        }
        if (specifier.startsWith('.')) {
          const resolved = path.resolve(path.dirname(filename), specifier);
          const exactVariationTypeImport = relative === 'lib/renderers.ts' && (specifier === localVariation || specifier === curmudgeonEntry)
            && ts.isImportDeclaration(node) && node.importClause?.isTypeOnly;
          assert(exactVariationTypeImport || resolved.startsWith(appDir + path.sep), `Demo source imports outside its package: ${relative} → ${specifier}`);
        }
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const specifier = node.arguments[0].text;
        if (specifier.includes('/.private-renderers/')) {
          const loader = ts.findAncestor(node, ancestor => ts.isFunctionDeclaration(ancestor));
          assert(relative === 'lib/renderers.ts' && privateStudies.get(specifier)?.[0] === loader?.name?.text,
            `Unexpected private study import: ${relative} → ${specifier}`);
          lazyPrivateStudies.set(specifier, 1 + (lazyPrivateStudies.get(specifier) ?? 0));
        }
        if (specifier === puppetAdapter) {
          const loader = ts.findAncestor(node, ancestor => ts.isFunctionDeclaration(ancestor));
          assert(relative === 'lib/renderers.ts' && loader?.name?.text === 'mountPuppet',
            `Ink Puppet adapter import must remain in its mount entry: ${relative}`);
          lazyPuppetImports++;
        }
        if (specifier.startsWith('.') && !path.resolve(path.dirname(filename), specifier).startsWith(appDir + path.sep)) {
          const loader = ts.findAncestor(node, ancestor => ts.isFunctionDeclaration(ancestor));
          const trickster = specifier === localVariation && loader?.name?.text === 'mountTrickster';
          const curmudgeon = specifier === curmudgeonEntry && loader?.name?.text === 'mountCurmudgeon';
          assert(relative === 'lib/renderers.ts' && (trickster || curmudgeon),
            `Unexpected out-of-package renderer import: ${relative} → ${specifier}`);
          if (trickster) lazyVariationImports++;
          if (curmudgeon) lazyCurmudgeonImports++;
        }
        if (specifier.startsWith('ascii-animals-review')) {
          assert(Object.hasOwn(packageFactories, specifier), `Unexpected renderer import: ${specifier}`);
          const loader = ts.findAncestor(node, ancestor => ts.isFunctionDeclaration(ancestor));
          assert(loader?.name?.text === 'mountRenderer', `Renderer imports must remain inside the on-demand mount entry point: ${relative}`);
          dynamicSpecifiers.add(specifier);
        }
      }
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(parsed).toLowerCase() === 'iframe') {
        throw new Error(`The package consumer must not embed legacy studios: ${relative}`);
      }
      ts.forEachChild(node, inspect);
    };
    inspect(parsed);
  }
  assert.deepEqual([...dynamicSpecifiers].sort(), Object.keys(packageFactories).sort(), 'Every real renderer entry must be reached by a lazy package import');

  const packageRoot = path.join(appDir, 'node_modules/ascii-animals-review');
  const metadata = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  for (const specifier of dynamicSpecifiers) {
    const key = specifier === 'ascii-animals-review' ? '.' : `.${specifier.slice('ascii-animals-review'.length)}`;
    const entry = metadata.exports[key];
    assert(entry && typeof entry.import === 'string' && typeof entry.types === 'string', `Missing package export: ${key}`);
    assert(entry.import.startsWith('./lib/') && entry.types.startsWith('./lib/'), `Consumer must resolve built files: ${key}`);
    const expected = await realpath(path.join(packageRoot, entry.import));
    const resolved = await realpath(fileURLToPath(import.meta.resolve(specifier)));
    assert.equal(resolved, expected, `Bare import does not resolve the installed package export: ${specifier}`);
    await readFile(expected);
    await readFile(path.join(packageRoot, entry.types));
  }

  assert.equal(lazyVariationImports, 1, 'Exactly one local variation must be imported on demand');
  assert.equal(lazyPuppetImports, 1, 'Exactly one Ink Puppet adapter must be imported on demand');
  assert.equal(lazyCurmudgeonImports, 1, 'Exactly one Reef Curmudgeon renderer must be imported on demand');
  for (const [specifier, [, factory]] of privateStudies) {
    assert.equal(lazyPrivateStudies.get(specifier), 1, `Exactly one lazy import required for ${factory}`);
  }
  const factories = new Set([...Object.values(packageFactories), localVariationFactory, puppetFactory, curmudgeonFactory,
    ...[...privateStudies.values()].map(([, factory]) => factory)]);
  const factoryChunks = new Map([...factories].map(factory => [factory, new Set()]));
  const chunkRoot = path.join(outputDir, '_next/static/chunks');
  for (const relative of (await filesBelow(chunkRoot)).filter(file => file.endsWith('.js'))) {
    const filename = path.join(chunkRoot, relative);
    const parsed = ts.createSourceFile(filename, await readFile(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const inspect = node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'd' && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
        for (const property of node.arguments[1].properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isArrowFunction(property.initializer)) continue;
          const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : '';
          if (factories.has(name)) factoryChunks.get(name).add(`_next/static/chunks/${relative}`);
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(parsed);
  }
  for (const [factory, chunks] of factoryChunks) assert.equal(chunks.size, 1, `Expected one emitted Webpack entry chunk for ${factory}; update this build-format-specific check before claiming lazy chunks`);
  const rendererChunks = new Set([...factoryChunks.values()].flatMap(chunks => [...chunks]));
  assert.equal(rendererChunks.size, factories.size, 'Unrelated renderer factories were combined into one entry chunk');
  const initialPages = ['index.html', ...species.map(slug => `animals/${slug}/index.html`)];
  for (const file of initialPages) {
    const elements = htmlTags?.get(file) ?? tags(await readFile(path.join(outputDir, file), 'utf8'));
    for (const { name, attributes } of elements) {
      const raw = name === 'script' ? attributes.src : name === 'link' && (attributes.rel === 'modulepreload' || ['preload', 'prefetch'].includes(attributes.rel) && attributes.as === 'script') ? attributes.href : null;
      if (!raw) continue;
      const url = new URL(raw, `https://static.example${basePath}/${file}`);
      if (url.origin !== 'https://static.example') continue;
      const relative = decodeURIComponent(url.pathname.slice(basePath.length + 1));
      assert(!rendererChunks.has(relative), `Renderer code is eagerly included or preloaded: ${file} → ${relative}`);
    }
  }
  return { lazyPackageEntries: dynamicSpecifiers.size, eagerPackageImports, separateFactoryChunks: rendererChunks.size, initialPagesWithoutFactoryChunks: initialPages.length };
}

export async function checkExport({ outputDir = exportRoot, legacyDir = legacyRoot } = {}) {
  const allFiles = await filesBelow(outputDir);
  const fileSet = new Set(allFiles);
  for (const route of species) assert(fileSet.has(`animals/${route}/index.html`), `Missing refreshable static route: ${route}`);
  for (const file of ['index.html', '404.html', '.nojekyll', legacyManifestName]) assert(fileSet.has(file), `Missing export artifact: ${file}`);
  assert.equal((await stat(path.join(outputDir, '.nojekyll'))).size, 0, '.nojekyll must be an empty file');

  const manifest = JSON.parse(await readFile(path.join(outputDir, legacyManifestName), 'utf8'));
  assert.equal(manifest.schema, 'ascii-animals/legacy-preservation/v1');
  assert.equal(manifest.basePath, basePath);
  const sourceFiles = (await filesBelow(legacyDir)).filter(file => file !== 'index.html');
  assert.deepEqual(manifest.files.map(file => file.path), sourceFiles, 'Every original asset except the catalogue must be retained');
  for (const entry of manifest.files) {
    const [before, after] = await Promise.all([readFile(path.join(legacyDir, entry.path)), readFile(path.join(outputDir, entry.path))]);
    assert(before.equals(after), `Legacy bytes changed: ${entry.path}`);
    assert.equal(after.length, entry.bytes, `Legacy byte count changed: ${entry.path}`);
    assert.equal(sha256(after), entry.sha256, `Legacy hash changed: ${entry.path}`);
  }

  const htmlTags = new Map();
  for (const file of allFiles.filter(file => file.endsWith('.html'))) htmlTags.set(file, tags(await readFile(path.join(outputDir, file), 'utf8')));
  const rootIds = new Set(htmlTags.get('index.html').map(tag => tag.attributes.id).filter(Boolean));
  for (const id of ['catalogue', 'library', 'title', 'manta-ray', 'sea-turtle']) assert(rootIds.has(id), `Legacy catalogue fragment is missing: #${id}`);
  let links = 0, fragments = 0;
  for (const [file, elements] of htmlTags) {
    for (const { name, attributes } of elements) {
      const raw = ['a', 'link'].includes(name) ? attributes.href : ['script', 'img', 'source', 'video'].includes(name) ? attributes.src : undefined;
      if (!raw || /^(?:data|blob|mailto|tel):/i.test(raw)) continue;
      const url = new URL(raw, `https://static.example${basePath}/${file}`);
      if (url.origin !== 'https://static.example') continue;
      assert(url.pathname === basePath || url.pathname.startsWith(`${basePath}/`), `Link escapes the Pages base path: ${file} → ${raw}`);
      let target = decodeURIComponent(url.pathname.slice(basePath.length + 1));
      if (!target || target.endsWith('/')) target += 'index.html';
      if (!fileSet.has(target) && fileSet.has(`${target}/index.html`)) target += '/index.html';
      assert(fileSet.has(target), `Broken static link: ${file} → ${raw} (${target})`);
      links++;
      if (url.hash && url.hash !== '#' && htmlTags.has(target)) {
        const id = decodeURIComponent(url.hash.slice(1));
        assert(htmlTags.get(target).some(tag => tag.attributes.id === id || tag.attributes.name === id), `Broken fragment: ${file} → ${raw}`);
        fragments++;
      }
    }
  }

  let moduleImports = 0;
  for (const entry of manifest.files.filter(file => /\.m?js$/.test(file.path))) {
    const source = await readFile(path.join(outputDir, entry.path), 'utf8');
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(entry.path), match[1]));
      assert(fileSet.has(dependency), `Missing legacy module dependency: ${entry.path} → ${match[1]}`);
      moduleImports++;
    }
  }
  assert(moduleImports > 0, 'The check must inspect real legacy module dependencies');
  const consumer = await checkConsumerImports({ outputDir, htmlTags });
  const seo = await checkSeo({ outputDir });
  return { canonicalSpeciesRoutes: species.length, legacyFilesPreserved: manifest.files.length, localLinksChecked: links, fragmentsChecked: fragments, legacyModuleImportsChecked: moduleImports, ...consumer, ...seo, staticFallback: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await checkExport(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
