import { createOctopusTrickster, type OctopusTricksterController, type OctopusTricksterOptions } from '../browser.mjs';
import { createOctopusState, sampleOctopus, stepOctopus, type OctopusPose, type OctopusStage } from '../core.mjs';

const options: OctopusTricksterOptions = { seed: 17, autoStart: false, paused: false,
  observeVisibility: true, reducedMotion: 'system', maxDpr: 2 };
const artwork: OctopusTricksterController = createOctopusTrickster(document.createElement('canvas'), options);
const accepted: boolean = artwork.invite(.7, .33);
artwork.pulse(-.5, .1); artwork.release(); artwork.advance(1 / 60); artwork.render();
artwork.setPaused(true); artwork.restart(); artwork.setOptions({ seed: 18, maxDpr: 1 });
const pose: OctopusPose = artwork.getStats().pose;
const stage: OctopusStage = artwork.getStats().stage;
const paused: boolean = artwork.paused;
const alive: boolean = !artwork.getStats().pauseReasons.destroyed;
const state = createOctopusState(17);
stepOctopus(state, [{ type: 'invite', x: -.7, y: .3 }]);
const sample: OctopusPose = sampleOctopus(state);
artwork.destroy(); artwork.dispose();
void [accepted, pose, stage, paused, alive, sample];

// @ts-expect-error Motion policy is a declared choice, not an arbitrary string.
artwork.setOptions({ reducedMotion: 'always' });
// @ts-expect-error Prototype options do not advertise unknown public options.
artwork.setOptions({ species: 'octopus' });
// @ts-expect-error Coordinates must be numeric.
artwork.invite('left', 0);
// @ts-expect-error Pausing takes a boolean.
artwork.setPaused('true');
// @ts-expect-error The controller's canvas is read-only.
artwork.canvas = document.createElement('canvas');
