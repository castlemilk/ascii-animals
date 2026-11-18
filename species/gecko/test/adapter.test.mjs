import test from 'node:test';
import assert from 'node:assert/strict';
import { createProposedGeckoDefinition } from '../compiled/proposed-adapter.js';

test('proposal writer adapter uses explicit materials, fixed tick and bounded output',()=>{
  const definition=createProposedGeckoDefinition({skin:7,pad:8,eye:9,pupil:10});
  const state=definition.create({},37);
  definition.update(state,[{type:'startle',tick:1,seq:1}],1/60);
  assert.equal(state.model.getSnapshot().behavior.kind,'startle');
  const before=state.model.getSnapshot();
  for(const dt of [0,.1,NaN,Infinity,1/30])assert.throws(()=>definition.update(state,[],dt));
  assert.deepEqual(state.model.getSnapshot(),before);
  const points=[];
  const writer={capacity:definition.maxSamples,count:0,write(...point){points.push(point);this.count++;return true;}};
  definition.sample(state,writer);
  assert(points.length>1000&&points.length<=definition.maxSamples);
  assert.deepEqual([...new Set(points.map(p=>p[4]))].sort((a,b)=>a-b),[7,8,9,10]);
  assert(points.every(p=>p.every(Number.isFinite)));
  assert.match(definition.describe(state),/startle/);
  state.model.dispose();
  assert.throws(()=>definition.describe(state));
});

test('proposal rejects insufficient capacity before writes and reports rejected writes',()=>{
  const definition=createProposedGeckoDefinition({skin:0,pad:1,eye:2,pupil:3}),state=definition.create({},0);
  let writes=0;
  assert.throws(()=>definition.sample(state,{capacity:100,count:0,write(){writes++;return true;}}));
  assert.equal(writes,0);
  assert.throws(()=>definition.sample(state,{capacity:definition.maxSamples,count:0,write(){return false;}}),/discard this host frame/);
  assert.throws(()=>createProposedGeckoDefinition({skin:0,pad:1,eye:NaN,pupil:3}));
});
