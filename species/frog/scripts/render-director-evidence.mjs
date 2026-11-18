/** Actual native Canvas capture, deliberately separate from browser acceptance. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createFrogPond, stepFrogPond, FROG_DIRECTOR_DEFAULTS } from '../generated/pond.mjs';
import { nativePreview, createCanvas, captureFont } from './native-host.mjs';
const out = resolve(process.argv[2] || new URL('../director/evidence', import.meta.url).pathname);
await mkdir(out, { recursive: true }); await mkdir(`${out}/frames`, { recursive: true });
const scenes = ['stillwater', 'firefly-supper', 'moonlit-chorus'];
const viewport = [720, 440], previewOptions = { cols: 180, rows: 100, labels: true, trajectories: true };
// Three explicit 6-second segments at 10 presentation frames/second; model 60Hz.
// Deliberate inputs exercise environmental attention, safe-perch hunt, and replies.
const scripts = {
  'stillwater': [ { type: 'ripple', x: -.25, y: .15, tick: 30, seq: 0 }, { type: 'hop', frogId: 0, padId: 3, tick: 160, seq: 1 } ],
  'firefly-supper': [ { type: 'hunt', frogId: 1, x: .7, y: -.5, tick: 30, seq: 0 } ],
  'moonlit-chorus': [ { type: 'call', frogId: 0, tick: 30, seq: 0 } ],
};
const { canvas, preview } = nativePreview(...viewport, previewOptions), context = canvas.getContext('2d');
// Native Canvas retains bitmap caches outside the JS heap. Explicit collection
// bounds this capture harness; it is not browser memory/performance evidence.
if (typeof globalThis.gc !== 'function') throw new Error('Run capture with node --expose-gc for bounded native-cache collection');
const frames = [], picked = [], replay = [];
const contactTicks = [0, 55, 95, 220];
for (const scene of scenes) {
  let state = createFrogPond({ seed: 23, director: { scene, autonomy: false } });
  replay.push({ scene, seed: 23, tickRate: 60, director: state.config, bodyConfig: state.bodyConfig, events: scripts[scene] });
  for (let tick = 0; tick <= 360; tick++) {
    if (tick) state = stepFrogPond(state, tick, scripts[scene].filter(event => event.tick === tick)).state;
    if (contactTicks.includes(tick)) picked.push({ scene, tick, state });
    if (tick % 6 !== 0) continue;
    const result = preview.drawPond(state);
    context.fillStyle = '#d1e7ac'; context.font = '16px "Liberation Mono", monospace'; context.textAlign = 'left';
    context.fillText(`FROG POND / ${scene.toUpperCase().replaceAll('-', ' ')}`, 24, 30);
    context.fillStyle = '#8ea591'; context.font = '11px "Liberation Mono", monospace';
    context.fillText(`TICK ${tick}  |  ${state.actors.map(a => `${a.name}: ${a.motive.kind}`).join('  /  ')}`, 24, 51);
    context.fillText('NATIVE CANVAS · SEED 23 · 60Hz MODEL · 10fps CAPTURE · NOT A BROWSER RECORDING', 24, viewport[1] - 20);
    const file = `frames/${String(frames.length).padStart(4, '0')}.png`;
    await writeFile(`${out}/${file}`, canvas.toBuffer('image/png'));
    globalThis.gc();
    frames.push({ file, scene, tick, actorGlyphs: result.actorGlyphs, samples: result.samples, environmentSamples: result.environmentSamples,
      motives: state.actors.map(a => a.motive.kind), phases: state.actors.map(a => a.model.behavior.kind) });
  }
}
const sheet = createCanvas(1800,1365), sheetContext = sheet.getContext('2d');
sheetContext.fillStyle = '#101713'; sheetContext.fillRect(0,0,sheet.width,sheet.height);
sheetContext.fillStyle = '#d1e7ac'; sheetContext.font = '26px monospace'; sheetContext.fillText('FROG / A POND WITH ITS OWN RHYTHM',24,38);
sheetContext.fillStyle = '#9fb39c'; sheetContext.font = '14px monospace'; sheetContext.fillText('Actual native Canvas pixels. Rows: Stillwater / Firefly supper / Moonlit chorus. Explicit replay in director-replay.json.',24,65);
for (const [index,item] of picked.entries()) {
  const col=index%4,row=Math.floor(index/4); preview.drawPond(item.state);
  sheetContext.drawImage(canvas,col*450,95+row*405,450,280);
  sheetContext.fillStyle='#c5de8a'; sheetContext.font='15px monospace'; sheetContext.fillText(`${item.scene} · tick ${item.tick}`,col*450+15,401+row*405);
  sheetContext.fillStyle='#9fb39c'; sheetContext.font='12px monospace'; sheetContext.fillText(item.state.actors.map(a=>`${a.name}:${a.motive.kind}`).join(' / '),col*450+15,424+row*405);
  globalThis.gc();
}
await writeFile(`${out}/frog-director-contact-sheet.png`,sheet.toBuffer('image/png'));
let callState=createFrogPond({director:{autonomy:false}});
for(let tick=1;tick<=72;tick++)callState=stepFrogPond(callState,tick,tick===30?[{type:'call',frogId:0,tick,seq:0}]:[]).state;
preview.drawPond(callState);await writeFile(`${out}/frog-director-poster.png`,canvas.toBuffer('image/png'));
await writeFile(`${out}/frog-director-specimen.txt`,preview.toText()+'\n'); globalThis.gc();
const comparisons=createCanvas(1440,480), cc=comparisons.getContext('2d');cc.fillStyle='#101713';cc.fillRect(0,0,1440,480);
for(const [index,value] of [createFrogPond({director:{autonomy:false}}),callState].entries()){
  preview.drawPond(value);cc.drawImage(canvas,index*720,40);cc.fillStyle='#c5de8a';cc.font='16px monospace';cc.fillText(index===0?'REST / SAME COMPOSITION':'CALL / MOSS AT ENVELOPE PEAK (age 42)',index*720+24,28); globalThis.gc();
}
await writeFile(`${out}/call-comparison.png`,comparisons.toBuffer('image/png'));
const small=nativePreview(390,520,previewOptions);const smallResult=small.preview.drawPond(callState);
await writeFile(`${out}/frog-director-mobile.png`,small.canvas.toBuffer('image/png'));small.preview.dispose(); globalThis.gc();
const reduced=nativePreview(...viewport,previewOptions);const reducedSheet=createCanvas(1350,330), rc=reducedSheet.getContext('2d');rc.fillStyle='#101713';rc.fillRect(0,0,1350,330);
for(const [index,still] of ['call','hunt','ripple'].entries()){
  reduced.preview.drawPond(createFrogPond({director:{autonomy:false}}),{motion:false,staticPose:'rest',pondStill:still});
  rc.drawImage(reduced.canvas,index*450,35,450,280);rc.fillStyle='#c5de8a';rc.font='14px monospace';rc.fillText(`REDUCED MOTION / STATIC ${still.toUpperCase()}`,index*450+14,23); globalThis.gc();
}
await writeFile(`${out}/reduced-motion-stills.png`,reducedSheet.toBuffer('image/png'));reduced.preview.dispose();
await writeFile(`${out}/director-replay.json`,JSON.stringify({schemaVersion:1,evidence:'native Canvas',segments:replay},null,2)+'\n');
await writeFile(`${out}/native-capture.json`,JSON.stringify({evidence:'actual @napi-rs/canvas pixels; NOT browser, DOM or deployed evidence',node:process.version,
  viewport,dpr:1,previewOptions,defaultDirector:FROG_DIRECTOR_DEFAULTS,font:captureFont,fontRights:'Installed system font used for pixels; no font binary redistributed.',
  frames,contactTicks,sceneCount:3,presentationFps:10,modelHz:60,mobile:{viewport:[390,520],actorGlyphs:smallResult.actorGlyphs},
  nativeCaptureHarness:'--expose-gc per frame; initial uncollected 900x560 run was killed with exit137 after one saved frame. Native memory is not browser heap evidence.',
  pending:['browser execution of this new demo','physical mobile touch','screen-reader semantics','browser p95/p99 and heap','minimum-grid all-anatomy recognition','human normal-speed motion review']},null,2)+'\n');
preview.dispose();
console.log(JSON.stringify({output:out,frames:frames.length,scenes:scenes.length,maxSamples:Math.max(...frames.map(f=>f.samples)),minActorGlyphs:Math.min(...frames.flatMap(f=>f.actorGlyphs)),evidence:'native Canvas only'},null,2));
