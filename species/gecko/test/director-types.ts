import {
  createGeckoDirector, resolveGeckoDirectorOptions, DEFAULT_GECKO_DIRECTOR_OPTIONS,
  GECKO_DIRECTOR_LIMITS, GECKO_SCENES, geckoSceneArc, geckoDirectorPoster,
} from '../src/director.js';
import type {
  GeckoDirector, GeckoDirectorConfig, GeckoDirectorOptions, GeckoDirectorOptionsPatch,
  GeckoDirectorReset, GeckoDirectorEvent, GeckoDirectorCue, GeckoDirectorReceipt,
  GeckoDirectorState, GeckoDirectorStepResult, GeckoDirectorRecipe, GeckoSceneArc,
  GeckoIndividualState, GeckoIndividualId, GeckoRole,
} from '../src/director.js';
import { renderGeckoDirectorGrid } from '../src/director-preview.js';
import type { GeckoDirectorPreviewOptions } from '../src/director-preview.js';
import { createGecko, DEFAULT_GECKO_HABITAT } from '../src/gecko.js';
import type { GeckoConfig, GeckoHabitat, GeckoGrid, GeckoViewport } from '../src/types.js';
import { mountGecko } from '../src/browser.js';
import type { GeckoActionResult, GeckoDirectorActionResult } from '../src/browser.js';

const roles: readonly GeckoRole[] = ['scout', 'hunter', 'sentry'];
const config: GeckoDirectorConfig = {
  seed: 37, heading: -.4,
  options: { scene: 'lantern-hunt', population: 3, roles, tempo: .8, boldness: .6,
    reverse: false, showRoutes: true, autonomy: true },
  animal: { creepSpeed: .15, toeSpread: 1.05, curlStrength: .9 },
};
const director: GeckoDirector = createGeckoDirector(config);
const defaults: Readonly<GeckoDirectorOptions> = DEFAULT_GECKO_DIRECTOR_OPTIONS;
const patch: GeckoDirectorOptionsPatch = { scene: 'moonlit-wall', population: 2, roles: ['hunter'] };
const resolved: Readonly<GeckoDirectorOptions> = director.update(patch);
const events: readonly GeckoDirectorEvent[] = [
  { type: 'select', tick: 1, seq: 1, id: 'pip' },
  { type: 'guide', tick: 1, seq: 2, x: .2, y: -.3 },
  { type: 'moth', tick: 1, seq: 3, id: 'pip', x: .25, y: -.2 },
];
const result: GeckoDirectorStepResult = director.step(events);
const snapshot: GeckoDirectorState = director.getSnapshot();
const individual: GeckoIndividualState = snapshot.individuals[0]!;
const id: GeckoIndividualId = individual.id;
director.select(id);
director.select(null);
director.updateAnimal({ tailLength: .9, stepTicks: 18 });
const reset: GeckoDirectorReset = { seed: 0, heading: Math.PI };
const resetState: GeckoDirectorState = director.reset(reset);
const recipe: GeckoDirectorRecipe = director.exportRecipe();
const startsAtTick: 0 = recipe.startsAtTick;
const recipeHeading: number | undefined = recipe.heading;
const replay = createGeckoDirector({ seed: recipe.seed, options: recipe.options, animal: recipe.animal,
  ...(recipe.heading === undefined ? {} : { heading: recipe.heading }) });
const cue: GeckoDirectorCue = { type: 'shadow', id: 'mica' };
const coordinateCue: GeckoDirectorCue = { type: 'inspect', x: -.2, y: .1 };
const poster: GeckoDirectorState = geckoDirectorPoster(snapshot, cue);
const previewOptions: GeckoDirectorPreviewOptions = { cols: 224, rows: 144, focus: null, neutral: false };
const grid: GeckoGrid = renderGeckoDirectorGrid(poster, previewOptions);
const viewport: GeckoViewport | undefined = grid.viewport;
renderGeckoDirectorGrid(snapshot, { cols: 112, rows: 72, focus: 'pip' });
void [defaults, resolved, result, resetState, startsAtTick, recipeHeading, replay, coordinateCue,
  viewport, GECKO_DIRECTOR_LIMITS, GECKO_SCENES, resolveGeckoDirectorOptions];

function describeReceipt(receipt: GeckoDirectorReceipt): string {
  if (receipt.outcome === 'ignored') {
    const type: 'shadow' = receipt.type;
    const reason: 'busy' = receipt.reason;
    const owner: GeckoIndividualId = receipt.id;
    return `${type}: ${owner} is ${reason}`;
  }
  const owner: GeckoIndividualId | null = receipt.id;
  // @ts-expect-error Applied inputs have no busy reason.
  void receipt.reason;
  return `${receipt.type}: ${owner}`;
}

function describeArc(arc: GeckoSceneArc): string {
  switch (arc.scene) {
    case 'moonlit-wall': {
      const beat: 'emerge' | 'climb' | 'inspect' | 'traverse' | 'perch' = arc.beat;
      // @ts-expect-error The wall scene cannot have a hunt-only strike beat.
      const strike: 'strike' = arc.beat;
      void strike;
      return beat;
    }
    case 'lantern-hunt': {
      const beat: 'notice' | 'stalk' | 'poise' | 'strike' | 'return' = arc.beat;
      return beat;
    }
    case 'passing-shadow': {
      const beat: 'peek' | 'explore' | 'shadow' | 'shelter' | 'return' | 'settle' = arc.beat;
      return beat;
    }
    default: {
      const exhaustive: never = arc;
      return exhaustive;
    }
  }
}
void [describeReceipt, describeArc, geckoSceneArc('moonlit-wall', .5)];

const habitat: GeckoHabitat = { extentX: 2, extentY: 1, origin: { x: -.5, y: .4 } };
const soloConfig: GeckoConfig = { habitat: { extentX: 2, origin: { x: 0, y: 0 } } };
const solo = createGecko(soloConfig);
solo.reset({ habitat: { extentY: 1 } });
void [habitat, DEFAULT_GECKO_HABITAT];

declare const canvas: HTMLCanvasElement;
const host = mountGecko(canvas, { config: { seed: 37, heading: -.4 },
  director: { scene: 'passing-shadow', population: 3 }, paused: true });
const optionalScene: GeckoDirectorState | null = host.getDirectorSnapshot();
const optionalRecipe: GeckoDirectorRecipe | null = host.exportScene();
host.configureDirector({ tempo: 1.1, roles: ['hunter', 'scout', 'sentry'] });
host.selectGecko('pip');
const directed: GeckoDirectorActionResult = host.direct({ type: 'moth', id: 'pip', x: .2, y: -.2 });
if (directed.outcome === 'ignored') {
  const reason: 'resting' | 'busy' = directed.reason;
  void reason;
}
const legacyAction: GeckoActionResult = host.startle();
if (legacyAction.outcome === 'ignored') {
  // Existing solo consumers retain the original discriminant, without a new busy variant.
  const reason: 'resting' = legacyAction.reason;
  void reason;
}
void [optionalScene, optionalRecipe];

// @ts-expect-error Species-exclusive scenes are a closed union.
createGeckoDirector({ options: { scene: 'coral-reef' } });
// @ts-expect-error Population is numeric, not a UI string.
director.update({ population: '3' });
// @ts-expect-error Every supplied role must be known.
director.update({ roles: ['pilot'] });
// @ts-expect-error Director settings are distinct from animal morphology.
director.update({ tailLength: 1 });
// @ts-expect-error Animal updates cannot smuggle director controls.
director.updateAnimal({ scene: 'moonlit-wall' });
// @ts-expect-error Population is nested in options at creation.
createGeckoDirector({ population: 2 });
// @ts-expect-error Seed is reset-only rather than a live director option.
director.update({ seed: 7 });
// @ts-expect-error Director reset has its own supported schema; its scene owns habitat placement.
director.reset({ habitat: { extentX: 2 } });
// @ts-expect-error Reset is not a replacement director settings operation.
director.reset({ scene: 'lantern-hunt' });
// @ts-expect-error A valid target is a stable member ID or null.
director.select('fourth-gecko');
// @ts-expect-error Explicit undefined does not satisfy exact optional configuration.
const undefinedConfig: GeckoDirectorConfig = { seed: undefined };
// @ts-expect-error Guidance requires both normalized coordinates.
const missingGuide: GeckoDirectorEvent = { type: 'guide', tick: 1, seq: 1, x: .2 };
// @ts-expect-error A deliberate cue either omits both coordinates or supplies both.
const partialCue: GeckoDirectorCue = { type: 'moth', x: .2 };
// @ts-expect-error A cue ID is optional, but null is reserved for selection.
const nullCue: GeckoDirectorCue = { type: 'shadow', id: null };
// @ts-expect-error Guide ID has the same non-null optional contract.
const nullGuide: GeckoDirectorEvent = { type: 'guide', tick: 1, seq: 1, x: 0, y: 0, id: null };
// @ts-expect-error Input discriminants are closed.
const unknownInput: GeckoDirectorEvent = { type: 'teleport', tick: 1, seq: 1 };
// @ts-expect-error Leave input carries no actor or coordinates.
const illegalLeave: GeckoDirectorEvent = { type: 'leave', tick: 1, seq: 1, id: 'mica' };
// @ts-expect-error Ordered simulation input requires an explicit tick and sequence.
director.step([{ type: 'shadow', id: 'mica' }]);
// @ts-expect-error Only shadow has an ignored/busy receipt.
const illegalReceipt: GeckoDirectorReceipt = { seq: 1, type: 'guide', outcome: 'ignored', reason: 'busy', id: 'mica' };
// @ts-expect-error An arc discriminates which beats belong to a scene.
const illegalArc: GeckoSceneArc = { scene: 'moonlit-wall', beat: 'strike', beatIndex: 0, cycle: 0, progress: 0, scoreTick: 0 };
// @ts-expect-error Snapshot membership is read-only.
snapshot.individuals.push(individual);
// @ts-expect-error Snapshot route coordinates are read-only.
individual.route[0]!.x = 2;
// @ts-expect-error Returned body habitats are read-only.
individual.body.habitat.origin.x = 2;
// @ts-expect-error Resolved role arrays are read-only.
resolved.roles.push('scout');
// @ts-expect-error Recipes are settings, not arbitrary state checkpoints.
const invalidRecipe: GeckoDirectorRecipe = { ...recipe, startsAtTick: 100 };
// @ts-expect-error There is no arbitrary snapshot restoration API.
director.restore(snapshot);
// @ts-expect-error Disposed is a read-only state indicator.
director.disposed = false;
// @ts-expect-error Director preview can focus only a stable member ID.
renderGeckoDirectorGrid(snapshot, { focus: 'fourth-gecko' });
// @ts-expect-error Renderer API does not accept alternate Unicode representations.
renderGeckoDirectorGrid(snapshot, { representation: 'braille' });
// @ts-expect-error Habitat origin must supply both coordinates.
createGecko({ habitat: { origin: { x: 0 } } });
// @ts-expect-error Habitat changes are reset-only, not morphology updates.
solo.update({ habitat });
// @ts-expect-error Viewport metadata requires both dimensions and both center coordinates.
const partialViewport: GeckoViewport = { width: 6.6, height: 4.4 };
// @ts-expect-error The optional authored grid theme is a closed literal.
const invalidTheme: GeckoGrid = { ...grid, theme: 'daylight' };
// @ts-expect-error Host scene configuration is separate from animal morphology updates.
host.update({ population: 3 });
// @ts-expect-error Direct host cues use the same complete coordinate-pair contract.
host.direct({ type: 'inspect', y: .4 });
// @ts-expect-error Public selection cannot address arbitrary unknown actor IDs.
host.selectGecko('fourth-gecko');
void [undefinedConfig, missingGuide, partialCue, nullCue, nullGuide, unknownInput, illegalLeave,
  illegalReceipt, illegalArc, invalidRecipe, partialViewport, invalidTheme];

director.dispose();
const isDisposed: boolean = director.disposed;
void isDisposed; // Runtime disposal is terminal; the interface does not claim typestate.
