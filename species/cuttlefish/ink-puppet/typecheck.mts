import { createInkPuppet, InkPuppetArtwork, type InkPuppetOptions, type PuppetInput } from './browser.mjs';

declare const canvas: HTMLCanvasElement;
const options: InkPuppetOptions = { seed: 7, autoStart: false, size: .65, habitat: true };
const puppet: InkPuppetArtwork = createInkPuppet(canvas, options);
const input: PuppetInput = { type: 'investigate', x: .25, y: -.1 };
const accepted: boolean = puppet.cue(input);
puppet.cue({ type: 'retreat' });
puppet.cue({ type: 'point', x: -.2, y: .1 });
puppet.cue({ type: 'leave' });
puppet.setTool('retreat');
puppet.showStill('retreat', 1.75, { x: .3, y: 0 });
puppet.showStill('idle', 0);
puppet.setOptions({ size: .35 });
puppet.setPaused(true);
puppet.advance(1 / 60);
puppet.subscribe(stats => { const tick: number = stats.tick; const paused: boolean = stats.paused; void [tick, paused]; });
const point: number = puppet.getState().point.x;
const phase: string = puppet.getStats().phase;
void [accepted, point, phase];

// Negative cases make this a test of actual .mjs type resolution, not an any import.
// @ts-expect-error Unknown option is not part of the isolated prototype contract.
puppet.setOptions({ count: 4 });
// @ts-expect-error Both normalized coordinates must be supplied together.
puppet.cue({ type: 'retreat', x: .2 });
// @ts-expect-error Point requires normalized coordinates.
puppet.cue({ type: 'point' });
// @ts-expect-error Wrong cue name.
puppet.cue({ type: 'ink' });
// @ts-expect-error Motion state is readonly; use setPaused.
puppet.paused = false;
// @ts-expect-error Stats are readonly snapshots.
puppet.getStats().tick = 100;
// @ts-expect-error Model snapshot coordinates cannot be mutated.
puppet.getState().point.x = .4;
// @ts-expect-error Options remain typed through the factory import.
createInkPuppet(canvas, { seed: 'seven' });

puppet.destroy();
