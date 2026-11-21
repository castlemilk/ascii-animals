/** Explicit private build; the public package/build/export map is untouched.
 * Run npm run build first, then:
 * node species/seahorse/variants/brass-button/build.mjs [output-directory]
 * The default output is ignored artifacts/seahorse-brass-button/. A host must
 * deliberately import adapter.mjs to mount the variation.
 */
import ts from 'typescript';
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../..');
const scheduler = path.join(root, 'lib/core/scheduler.js');
const sources = ['runtime', 'adapter'];

export async function buildBrassButton(output = path.join(root, 'artifacts/seahorse-brass-button')) {
  await access(scheduler).catch(() => { throw new Error('Build Original first with npm run build.'); });
  const out = path.resolve(output);
  const compilerOptions = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true,
    exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true,
    // The built internal scheduler is JavaScript without an emitted .d.ts.
    // Infer that existing dependency; strict checks still apply to private TS.
    allowJs: true, checkJs: false, skipLibCheck: false, noEmit: true,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  };
  const program = ts.createProgram(sources.map(name => path.join(directory, name + '.ts')), compilerOptions);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) throw new Error(ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  await mkdir(out, { recursive: true });
  // Node resolves emitted modules from their real directory (including macOS /var aliases).
  const [realOutput, realScheduler] = await Promise.all([realpath(out), realpath(scheduler)]);
  let schedulerImport = path.relative(realOutput, realScheduler).split(path.sep).join('/');
  if (!schedulerImport.startsWith('.')) schedulerImport = './' + schedulerImport;
  const files = {};
  for (const name of sources) {
    const source = await readFile(path.join(directory, name + '.ts'), 'utf8');
    let code = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
      isolatedModules: true, verbatimModuleSyntax: true,
    } }).outputText;
    if (name === 'runtime') {
      const dependency = "'../../../../lib/core/scheduler.js'";
      if (!code.includes(dependency)) throw new Error('Unexpected private scheduler dependency.');
      code = code.replace(dependency, JSON.stringify(schedulerImport));
    } else {
      if (!code.includes("'./runtime.js'")) throw new Error('Unexpected private runtime import.');
      code = code.replace("'./runtime.js'", "'./runtime.mjs'");
    }
    files[name] = path.join(out, name + '.mjs');
    await writeFile(files[name], code);
  }
  return Object.freeze(files);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await buildBrassButton(process.argv[2]), null, 2));
}
