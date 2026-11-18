/** The package harness replaces only these two built-entry imports with public specifiers. */
import * as rootApi from '../../../../lib/index.js';
import {
  createFoxArtwork, createFoxDirector, createFox, FOX_DIRECTOR_DEFAULTS,
  FOX_DIRECTOR_LIMITS, resolveFoxDirectorOptions,
  type FoxArtwork, type FoxBrowserOptions, type FoxDirector,
  type FoxDirectorCreateOptions, type FoxDirectorOptionsInput,
  type FoxDirectorInput, type FoxDirectorState, type FoxDirectorStepResult,
  type FoxDirectorFrame, type FoxTableau, type FoxActorIntent,
} from '../../../../lib/public/fox.js';

const settings: FoxDirectorOptionsInput = {
  scene: 'moon-play', count: 3, roles: ['hunter', 'playmate', 'lookout'],
  pace: 1.1, curiosity: .7, wind: -.2, spacing: 1, showLabels: true,
};
const createOptions: FoxDirectorCreateOptions = { ...settings, seed: 17, fox: { seed: 17 } };
const director: FoxDirector = createFoxDirector(createOptions);
const input: readonly FoxDirectorInput[] = [
  { type: 'guide', tick: 1, seq: 0, x: .2, y: .4 },
  { type: 'cue', tick: 1, seq: 1, cue: 'rustle', id: 1, x: .2, y: .4 },
];
const result: FoxDirectorStepResult = director.step(1, input);
const state: FoxDirectorState = result.state;
state.beat satisfies 'arrival' | 'listening' | 'investigation' | 'response' | 'settling';
result.kind satisfies 'advanced' | 'paused';
result.cue satisfies 'none' | 'accepted' | 'ignored-busy';
const frame: FoxDirectorFrame = director.getFrame('listen');
frame.actors[0]?.pose.species satisfies 'fox' | undefined;
const tableau: FoxTableau = 'rest';
director.getFrame(tableau);
director.configure({ scene: 'den-watch', count: 2 });
director.configureFox({ facing: 'left' });
director.select(1);
director.setPaused(true);
director.reset(17);
director.getFoxOptions().facing satisfies 'left' | 'right';
resolveFoxDirectorOptions(settings).roles satisfies readonly string[];
FOX_DIRECTOR_DEFAULTS.scene satisfies 'dusk-hunt' | 'moon-play' | 'den-watch';
FOX_DIRECTOR_LIMITS.maxActors satisfies number;

function readIntent(intent: FoxActorIntent): number {
  if (intent.kind === 'investigate') return intent.target.x + intent.age;
  if (intent.kind === 'rest') return intent.age;
  // @ts-expect-error Autonomous intent has no investigation target.
  intent.target;
  return 0;
}
state.actors.forEach(actor => readIntent(actor.intent));

declare const canvas: HTMLCanvasElement;
const browserOptions: FoxBrowserOptions = {
  director: settings,
  onDirectorInputs(batch) { batch[0]?.type satisfies FoxDirectorInput['type'] | undefined; },
};
const artwork: FoxArtwork = createFoxArtwork(canvas, browserOptions);
const rootArtwork: rootApi.FoxArtwork = rootApi.createFoxArtwork(canvas, browserOptions);
artwork.configureDirector({ scene: 'dusk-hunt' });
artwork.selectFox(1);
artwork.cue('play', 1, { x: .2, y: .4 });
artwork.showTableau(tableau);
artwork.getDirectorOptions()?.scene;
artwork.getStatus().director?.actors[0]?.intent.kind;
rootArtwork.update({ facing: 'right' });
rootArtwork.pause(); rootArtwork.restart(); rootArtwork.play();
createFox({ seed: 17 }).getState().species satisfies 'fox';

// @ts-expect-error New director factory belongs to ./fox, not the root contract.
rootApi.createFoxDirector({});
// @ts-expect-error A Fox ensemble is bounded to one, two, or three animals.
createFoxDirector({ count: 4 });
// @ts-expect-error Fox scenes do not accept marine scene names.
createFoxDirector({ scene: 'procession' });
// @ts-expect-error Roles are explicit Fox motives.
createFoxDirector({ roles: ['orbit'] });
// @ts-expect-error Seeds are numbers.
createFoxDirector({ seed: '17' });
// @ts-expect-error Browser director settings have no nested seed override.
createFoxArtwork(canvas, { director: { seed: 17 } });
// @ts-expect-error Browser animal options use the top-level fox field.
createFoxArtwork(canvas, { director: { fox: { seed: 17 } } });
// @ts-expect-error Director cues have explicit names.
artwork.cue('ink');
// @ts-expect-error A cue point requires both normalized coordinates.
artwork.cue('rustle', 1, { x: .3 });
// @ts-expect-error Still tableaux have explicit names.
director.getFrame('fly');
// @ts-expect-error Deterministic guide input requires tick and sequence.
director.step(2, [{ type: 'guide', x: .2, y: .4 }]);
// @ts-expect-error Returned configuration is readonly.
director.getOptions().roles.push('hunter');
// @ts-expect-error Returned actor snapshots are readonly.
state.actors[0]!.intent = { kind: 'autonomous' };
director.dispose(); artwork.dispose(); rootArtwork.dispose();
