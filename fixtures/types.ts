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

const mantaConfig: ArtworkOptions = {species:'manta', speciesByAnimal:['manta','octopus','cuttlefish'],seed:17};
createArtwork(document.createElement('canvas'),mantaConfig);
createArtwork(document.createElement('canvas'),{species:'octopus'});
// @ts-expect-error only implemented species are valid
createArtwork(document.createElement('canvas'),{speciesByAnimal:['dragon']});

import type {Species} from 'ascii-animals-review';
const species: Species = 'octopus';
void species;
