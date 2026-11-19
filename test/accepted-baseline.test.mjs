import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyAcceptedSource, mountAccepted } from './helpers/accepted-cuttlefish-baseline.mjs';
import { captureV6PreservedParts, sampleFingerprint } from './helpers/cuttlefish-v6-preservation.mjs';
test('all independent baseline identities reject even one altered source byte',()=>{
  for(const version of ['v3','v5','v6','v7']){
    const original=readFileSync(new URL(`./fixtures/accepted/${version}/src/animals/cuttlefish.js`,import.meta.url));
    verifyAcceptedSource(version,original);
    const changed=Buffer.from(original); changed[0]^=1;
    assert.throws(()=>verifyAcceptedSource(version,changed),/Accepted baseline source changed/);
  }
});
test('strict sample fingerprint rejects a one-ULP geometry change without tolerance',async()=>{
  const art=await mountAccepted('v6');
  try{
    const points=captureV6PreservedParts(art,{time:2.4,lod:1,grip:0}).mantleAndFins;
    const before=sampleFingerprint(points), altered=points.map(p=>p.slice());
    const bytes=new ArrayBuffer(8), floats=new Float64Array(bytes), bits=new BigUint64Array(bytes);
    floats[0]=altered[0][0]; bits[0]+=1n; altered[0][0]=floats[0];
    assert.notEqual(altered[0][0],points[0][0]);
    assert.notDeepEqual(sampleFingerprint(altered),before);
  }finally{art.destroy();}
});
