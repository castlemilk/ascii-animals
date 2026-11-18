/** Reproducible local checks with raw output. Does not launch/publish/deploy anything. */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const species=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const repo=resolve(species,'../..'), evidence=resolve(species,'evidence');
await mkdir(evidence,{recursive:true});
const checks=[];
function run(name, executable, args){
  const result=spawnSync(executable,args,{cwd:repo,encoding:'utf8'});
  const output=(result.stdout??'')+(result.stderr??'');
  checks.push({name,command:[executable,...args],exitCode:result.status,error:result.error?.message,output});
  if(result.status!==0) throw new Error(`${name} failed: ${output}`);
}
let failure;
try {
  run('TypeScript build',process.execPath,['species/dragonfly/scripts/build.mjs']);
  run('Positive and negative generated-declaration consumers',process.execPath,['species/dragonfly/scripts/build.mjs','--check']);
  run('Species geometry, state, rendering bounds and mocked lifecycle',process.execPath,['--test',
    'species/dragonfly/tests/model.test.mjs','species/dragonfly/tests/preview.test.mjs','species/dragonfly/tests/browser.test.mjs']);
  run('Unchanged cuttlefish numerical regression (stubbed Canvas)',process.execPath,['scripts/check-engine.cjs']);
  run('Legacy syntax',process.execPath,['--check','dist/artwork.js']);
  run('Optional browser runner syntax',process.execPath,['--check','species/dragonfly/scripts/browser-smoke.mjs']);
  const standalone=resolve(repo,'dist/cuttlefish.html');
  const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
  const before=await hash(standalone);
  run('Standalone reproducibility','python3',['scripts/build-standalone.py']);
  const after=await hash(standalone);
  if(before!==after) throw new Error('Legacy standalone changed on rebuild');
  checks.push({name:'Standalone checksum unchanged',exitCode:0,sha256:after});
} catch(error){failure=String(error);process.exitCode=1;}
const report={runtime:process.version,base:'0e446c47b491b751d484e40db753ec725652b515',
  status:failure?'fail':'pass',evidenceScope:'Numerical/type/bookkeeping tests; no real browser/phone/performance pass',checks,...(failure?{failure}:{})};
await writeFile(resolve(evidence,'checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.map(({name,exitCode,sha256})=>({name,exitCode,sha256})),failure},null,2));
