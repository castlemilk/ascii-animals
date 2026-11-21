import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('private factory and controller remain structurally assignable to the existing public host types', () => {
  const compiler = fileURLToPath(new URL('../../../../../node_modules/typescript/bin/tsc', import.meta.url));
  const contract = fileURLToPath(new URL('./structural-types.ts', import.meta.url));
  execFileSync(process.execPath, [compiler, '--noEmit', '--strict', '--exactOptionalPropertyTypes', '--skipLibCheck',
    '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--lib', 'ES2022,DOM,DOM.Iterable', contract],
  { stdio: 'pipe' });
});
