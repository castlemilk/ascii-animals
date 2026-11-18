import { createCuttlefish, CuttlefishArtwork, type CuttlefishOptions } from 'ascii-animals-review';
import { createCuttlefish as fromAnimal, type FishStats, type ReactionStage } from 'ascii-animals-review/cuttlefish';
import { createScheduler, type Scheduler, type FrameCallback } from 'ascii-animals-review/core';

const canvas = document.createElement('canvas');
const options: CuttlefishOptions = {
  scene: 'reactive', count: 4, formation: 'independent', autoStart: false,
  behaviors: ['hover', 'orbit'], reducedMotion: 'system', maxDpr: 2,
  maxPixels: 8294400, maxCells: 65536, maxFps: 60, observeVisibility: true,
};
const artwork: CuttlefishArtwork = createCuttlefish(canvas, options);
const alternate = fromAnimal(canvas, { mode: 'points' });
artwork.setOptions({ formation: 'diagonal', reverse: true });
artwork.setPaused(true);
artwork.restart();
artwork.resize();
artwork.render();
artwork.pulse();
artwork.advance(1 / 60);
const fish: FishStats[] = artwork.getStats().fish;
const stage: ReactionStage = artwork.getStats().reactionStage;
const running: boolean = artwork.getStats().running;
const cells: number = artwork.getStats().cells;
const scheduler: Scheduler = createScheduler({
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: id => cancelAnimationFrame(id),
  onError: error => { void error; },
});
const callback: FrameCallback = milliseconds => { void milliseconds; };
const unsubscribe = scheduler.subscribe(callback);
unsubscribe();
scheduler.dispose();
void [fish, stage, running, cells, scheduler.size];
artwork.destroy();
alternate.destroy();

// The declaration must reject invalid API values, not merely compile valid ones.
// @ts-expect-error invalid scene
createCuttlefish(canvas, { scene: 'jellyfish' });
// @ts-expect-error invalid behavior
artwork.setOptions({ behaviors: ['fly'] });
// @ts-expect-error string is not a numeric budget
artwork.setOptions({ maxPixels: 'unlimited' });
// @ts-expect-error construction does not accept a generic div
createCuttlefish(document.createElement('div'));
// @ts-expect-error scheduling requires a request/cancel host pair
createScheduler({ requestFrame: callback => requestAnimationFrame(callback) });
// @ts-expect-error seconds are numeric
artwork.advance('one second');

// First-class TypeScript facade, checked from the actual packed tarball.
import { createArtwork, normalizeOptions, DEFAULT_OPTIONS, type ArtworkOptions } from 'ascii-animals-review';
const config = { species: 'cuttlefish', count: 3, behaviors: ['hover', 'orbit'], maxFps: 30 } satisfies ArtworkOptions;
const typedArtwork = createArtwork(document.createElement('canvas'), config);
typedArtwork.update({ formation: 'vertical', reverse: true });
typedArtwork.pause(); typedArtwork.restart(); typedArtwork.play(); typedArtwork.pulse();
typedArtwork.update({ autoStart: false }); typedArtwork.advance(1 / 60);
const normalized = normalizeOptions(config);
const size: number = normalized.size;
typedArtwork.dispose(); typedArtwork.dispose();
// @ts-expect-error unsupported species are not invented
createArtwork(document.createElement('canvas'), { species: 'ray' });
// @ts-expect-error unknown public configuration
typedArtwork.update({ opacity: 0.5 });
// @ts-expect-error supported behavior names only
typedArtwork.update({ behaviors: ['dance'] });
// @ts-expect-error immutable defaults
DEFAULT_OPTIONS.count = 9;
// @ts-expect-error snapshot role lists are immutable
typedArtwork.getOptions().behaviors.push('hover');
// @ts-expect-error manual time is numeric
typedArtwork.advance('0.1');

import { createFoxArtwork as rootFox } from 'ascii-animals-review';
import { createFoxArtwork, createFox, type FoxArtwork, type FoxInput } from 'ascii-animals-review/fox';
const fox: FoxArtwork = createFoxArtwork(document.createElement('canvas'), { fox: { seed: 17, tailSway: .1 } });
fox.update({ pounceHeight: .2 }); fox.play(); fox.pause(); fox.restart(); fox.pulse();
fox.guide(.8, .15); fox.leave(); fox.showStaticPose('sniff'); fox.getOptions(); fox.exportText(); fox.dispose();
const rootFoxFactory: typeof createFoxArtwork = rootFox;
const model = createFox({ seed: 17 });
const input: FoxInput = { type: 'pounce', tick: 1, seq: 0 };
model.step(1, [input]); model.dispose();
// @ts-expect-error fox preserves its own supported option model
fox.update({ formation: 'horizontal' });
// @ts-expect-error fixed-tick model is not the seconds-based artwork API
fox.advance(.1);
// @ts-expect-error no unsupported pose or behavior
fox.showStaticPose('dance');
// @ts-expect-error callback input batches are readonly
createFoxArtwork(document.createElement('canvas'), { onInputs(batch) { batch.push(input); } });

import {createSeahorseArtwork,createSeahorseModel,type SeahorseOptions} from 'ascii-animals-review/seahorse';
import {createSeahorseArtwork as rootSeahorse} from 'ascii-animals-review';
const horseOptions={behavior:'holdfast',palette:'brass',columns:100} satisfies SeahorseOptions;
const horse=createSeahorseArtwork(document.createElement('canvas'),horseOptions);
const sameHorse:typeof createSeahorseArtwork=rootSeahorse;
horse.update({facing:'right',scale:1.1});horse.pause();horse.play();horse.restart();horse.pulse();horse.guide(0,.3);horse.getFrame();horse.dispose();
const horseModel=createSeahorseModel();horseModel.advanceTicks(10);horseModel.greet();
// @ts-expect-error seahorse does not pretend to support marine ink or formations
horse.update({formation:'diagonal'});
// @ts-expect-error only supported behavior values
horse.update({behavior:'pounce'});
// @ts-expect-error snapshots immutable
horse.getOptions().speed=3;
// @ts-expect-error explicit integer tick API uses numbers
horseModel.advanceTicks('10');
