import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const compiler=process.env.GECKO_TSC_JS;
const types=process.argv.includes('--types');
const project=resolve(root,types?'test/tsconfig.json':'tsconfig.json');
const result=spawnSync(compiler?process.execPath:'tsc',compiler?[compiler,'-p',project]:['-p',project],{stdio:'inherit'});
if(result.error) {
  console.error('Use an existing TypeScript 5.9+ compiler on PATH or set GECKO_TSC_JS to its lib/tsc.js.');
  console.error(result.error.message);
}
process.exitCode=result.status??1;
