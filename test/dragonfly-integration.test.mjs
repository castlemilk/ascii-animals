import test from 'node:test';
import assert from 'node:assert/strict';
import { createDragonflyArtwork, createDragonflyDirector } from '../lib/public/dragonfly.js';
import { createFoxArtwork } from '../lib/public/fox.js';
import { getBrowserScheduler } from '../lib/core/scheduler.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { buildDragonflyDemo } from '../scripts/build-dragonfly.mjs';

test('Dragonfly and Fox adapters share one scheduler and preserve individual lifecycle', () => {
  const host = fakeBrowser(), canvas = host.canvas(), foxCanvas = host.canvas();
  canvas.getContext('2d').measureText = () => ({ width: 5 });
  const fly = createDragonflyArtwork(canvas, { model: { seed: 17 } });
  const fox = createFoxArtwork(foxCanvas); host.intersect(foxCanvas, true);
  assert.equal(host.pending, 1); host.frame(); host.frame();
  assert(fly.getState().tick > 0); fly.dart(); host.frame(); assert.equal(fly.getState().behavior.kind, 'dart');
  fly.pause(); fly.restart(); assert.equal(fly.getStatus().paused, true);
  const before = fly.getState().tick; host.frame(); assert.equal(fly.getState().tick, before);
  fly.update({ motion: 'slow' }); fly.play(); host.frame(); host.frame();
  fly.dispose(); fly.dispose(); assert.equal(fly.disposed, true); assert.equal(host.pending, 1);
  assert.throws(() => fly.dart(), /disposed/); fox.dispose(); assert.equal(host.pending, 0);
});
test('Dragonfly static actions never override reduced motion and invalid options reject', () => {
  const host = fakeBrowser({ reducedMotion: true }), canvas = host.canvas();
  canvas.getContext('2d').measureText = () => ({ width: 5 });
  const fly = createDragonflyArtwork(canvas); fly.play(); const before = fly.getState().staticPose; fly.pulse();
  assert.notEqual(fly.getState().staticPose, before); assert.equal(fly.getState().tick, 0); assert.equal(host.pending, 0);
  assert.throws(() => fly.update({ wingHz: NaN })); assert.equal(fly.getState().tick, 0);
  fly.dispose(); assert.throws(() => createDragonflyArtwork(canvas, { unknown: true }));
});
test('Dragonfly real-adapter Pages demo is reproducible', async () => {
  assert.equal((await buildDragonflyDemo({ check: true })).entry, 'dist/dragonfly/index.html');
});

test('public Dragonfly director owns one canonical subscription for four members beside solo and Fox peers', () => {
  const host=fakeBrowser(),groupCanvas=host.canvas(),soloCanvas=host.canvas(),foxCanvas=host.canvas();
  for(const canvas of [groupCanvas,soloCanvas])canvas.getContext('2d').measureText=()=>({width:5});
  const scheduler=getBrowserScheduler(host.view);
  const group=createDragonflyArtwork(groupCanvas,{director:{count:4,scene:'attention'},model:{seed:17}});
  const solo=createDragonflyArtwork(soloCanvas);
  const fox=createFoxArtwork(foxCanvas);host.intersect(foxCanvas,true);
  assert.equal(scheduler.size,3,'The group contributes one subscriber, not one per member');
  assert.equal(host.pending,1);assert.equal(group.getDirectorState().members.length,4);
  assert.equal(solo.getDirectorState(),null);assert.equal(solo.getDirectorOptions(),null);
  assert.equal(group.getState().species,'dragonfly-v1','The public lead-model snapshot contract is preserved');
  host.frame();host.frame();
  group.selectIndividual(3);group.dart();host.frame();
  assert.equal(group.getDirectorState().selected,3);
  assert.equal(group.getDirectorState().members[3].phase.kind,'launch');
  assert.equal(group.getState().behavior.kind,'idle','Scene choreography does not pretend to be a legacy model dart');
  assert.throws(()=>group.update({count:2}));
  group.configureDirector({count:2});assert.equal(scheduler.size,3);
  group.update({wingHz:2});assert.equal(group.getOptions().wingHz,2);
  group.pause();group.restart();assert.equal(scheduler.size,2);
  assert.equal(group.getStatus().paused,true);assert.equal(group.getDirectorState().tick,0);
  group.play();assert.equal(scheduler.size,3);host.frame();host.frame();
  const soloTick=solo.getState().tick;
  group.dispose();group.dispose();assert.equal(scheduler.size,2);assert.equal(host.pending,1);
  assert(group.disposed);assert.throws(()=>group.cue('perch'),/disposed/);
  host.frame();host.frame();assert(solo.getState().tick>soloTick);
  solo.dispose();assert.equal(scheduler.size,1);
  fox.dispose();assert.equal(scheduler.size,0);assert.equal(host.pending,0);
});

test('public director reduced-motion actions remain static and preserve the legacy snapshot API', () => {
  const host=fakeBrowser({reducedMotion:true}),canvas=host.canvas();
  canvas.getContext('2d').measureText=()=>({width:5});
  const artwork=createDragonflyArtwork(canvas,{director:{count:4,scene:'relay'},model:{motion:'slow'}});
  const before=artwork.exportText();artwork.play();artwork.selectIndividual(2);artwork.pulse();
  assert.notEqual(artwork.exportText(),before);
  assert.equal(artwork.getDirectorState().selected,2);
  assert.equal(artwork.getDirectorState().tick,0);
  assert(artwork.getDirectorState().members.every(member=>member.modelTick===0));
  assert.equal(artwork.getState().tick,0);assert.equal(host.pending,0);
  assert.equal(artwork.getOptions().motion,'static');
  artwork.pause();artwork.restart();host.setReduced(false);
  assert.equal(artwork.getOptions().motion,'slow');assert.equal(artwork.getStatus().paused,true);
  assert.equal(host.pending,0);artwork.dispose();
});

test('public director factory exposes the same headless next-tick contract without mounting Canvas', () => {
  const director=createDragonflyDirector({count:4,scene:'patrol'},{seed:17});
  assert.equal(director.getState().tick,0);
  const result=director.step(1,[{type:'select',id:3,tick:1,seq:0}]);
  assert.equal(result.kind,'advanced');assert.equal(result.state.selected,3);
  assert.equal(director.getPrimaryState().species,'dragonfly-v1');
  assert.throws(()=>director.step(3));director.dispose();
});
