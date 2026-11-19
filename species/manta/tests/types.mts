import { createArtwork, type ArtworkOptions } from '../../../lib/index.js';
import { CuttlefishArtwork } from '../../../lib/animals/cuttlefish.js';
import {
  MantaReefArtwork, createMantaReef, type ReefOptions, type ReefStill, type ReefSnapshot
} from '../reef-artwork.mjs';
import {
  normalizeReefOptions, sampleReefPose, REEF_STILLS, REEF_RESPONSE_SECONDS, type ReefPose
} from '../reef-director.mjs';

declare const canvas: HTMLCanvasElement;
const options = { current: -.45, duration: 36, habitat: true } satisfies ReefOptions;
const reef = createMantaReef(canvas, options, { seed: 17, mode: 'ascii', reducedMotion: 'system' });
const marine: CuttlefishArtwork = reef;
const instance: MantaReefArtwork = new MantaReefArtwork(canvas);
const snapshot: Readonly<ReefSnapshot> = reef.getReef();
const accepted: boolean = reef.bank(-1);
const still: ReefStill = REEF_STILLS[0]!;
reef.showReefStill(still);
reef.setReef({ current: .6 });
reef.setOptions({ palette: 'lagoon', density: 1.2, glow: false });
reef.setPaused(false);
reef.restart();
reef.resize();
marine.destroy();
instance.destroy();

const duration: 8.8 = REEF_RESPONSE_SECONDS;
const pose: ReefPose = sampleReefPose({ time: duration, seed: 123,
  pointer: { x: .2, y: -.1, interest: 1 }, reactionAge: 2.3, side: 1, aspect: .78 }, options);
const x: number = pose.position[0];
const defaults = normalizeReefOptions();
void [accepted, snapshot, x, defaults];

// The established typed package entry keeps its contract unchanged.
const packageOptions = { species: 'manta', count: 1, seed: 17, scene: 'reactive',
  autoStart: false, reducedMotion: 'system' } satisfies ArtworkOptions;
const regular = createArtwork(canvas, packageOptions);
regular.advance(1 / 60); regular.pause(); regular.pulse(); regular.dispose();

// @ts-expect-error Bank direction is an explicit two-value choice.
reef.bank(0);
// @ts-expect-error Static chapters use the authored identifiers.
reef.showReefStill('escape');
// @ts-expect-error Reef habitat is a boolean.
reef.setReef({ habitat: 'true' });
// @ts-expect-error Configuration is not a new arbitrary option registry.
normalizeReefOptions({ count: 3 });
// @ts-expect-error Required sample time may not be omitted.
sampleReefPose({ seed: 17 });
// @ts-expect-error Motion is numeric, not an interaction action.
sampleReefPose({ time: 0, motion: 'bank' });
// @ts-expect-error Snapshots cannot mutate the mounted controller.
snapshot.current = 1;
// @ts-expect-error Snapshot configuration is immutable too.
snapshot.options.habitat = false;
// @ts-expect-error New study options are not silently added to the strict package facade.
createArtwork(canvas, { species: 'manta', current: .45 });
// @ts-expect-error The study owns one manta, not the shared mixed cast.
createMantaReef(canvas, {}, { species: 'octopus' });
// @ts-expect-error Population is restricted by this species-local study.
reef.setOptions({ count: 2 });
// @ts-expect-error The study director cannot be mixed with a shared marine director.
reef.setDirector({ scene: 'upwelling-ballet' });
