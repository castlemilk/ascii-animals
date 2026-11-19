// Same-runtime exact comparison against independently recovered accepted sources.
// No candidate source, tolerance, rounding, platform receipt or oracle rewrite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fakeBrowser } from './fake-browser.mjs';
const root = new URL('../fixtures/accepted/', import.meta.url);
const hashes = JSON.parse(readFileSync(new URL('sha256.json', root), 'utf8'));
const pinned = Object.freeze({
  v3:'cd1dc0d1cb60310afdaa86f2743be336fa97078a464f74511d6bf7af2d0d0f10',
  v5:'b65cb598f9944c1d89e8564db6707b684632cadcfd416e1365e1eb0bf58071dd',
  v6:'2dd02aa60ed0503d41f1bbd4d19554a9b37323c11ced16fbd037196b94a1e0f9',
  v7:'815dc158a2013a6590cdfce4d093e5092989eecfd0687ed952948583e56289ba',
});
export function verifyAcceptedSource(version, bytes) {
  assert(Object.hasOwn(pinned, version));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pinned[version], 'Accepted baseline source changed');
}
export async function mountAccepted(version) {
  const files=['src/animals/cuttlefish.js','src/animals/manta.js','src/animals/octopus.js','src/core/scheduler.js'];
  for(const file of files){
    const key=`${version}/${file}`, bytes=readFileSync(new URL(key,root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hashes[key],`Baseline dependency changed: ${key}`);
    if(file==='src/animals/cuttlefish.js') verifyAcceptedSource(version,bytes);
  }
  const { CuttlefishArtwork }=await import(new URL(`${version}/src/animals/cuttlefish.js`,root));
  return new CuttlefishArtwork(fakeBrowser().canvas(1000,650),{count:1,species:'cuttlefish',scene:'reactive',size:1.2,sizeVariation:0,seed:7,autoStart:false,paused:true,glow:false});
}
