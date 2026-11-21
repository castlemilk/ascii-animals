import { createArtwork, type ArtworkOptions } from '../../../lib/index.js';
import { CuttlefishArtwork } from '../../../lib/animals/cuttlefish.js';
import { createMantaReef } from '../reef-artwork.mjs';
import {
  MantaTidalKiteArtwork, createMantaTidalKite,
  type ReefArtworkOptions, type ReefTarget, type TidalKiteSnapshot
} from '../variants/tidal-kite/artwork.mjs';

declare const canvas: HTMLCanvasElement;
const options = { species: 'manta', count: 1, formation: 'independent', scene: 'reactive',
  seed: 17, autoStart: false, reducedMotion: 'system', mode: 'ascii' } satisfies ReefArtworkOptions;
const alternative = createMantaTidalKite(canvas, { current: -.4, habitat: true }, options);
const instance: MantaTidalKiteArtwork = new MantaTidalKiteArtwork(canvas);
const renderer: CuttlefishArtwork = alternative;
const target = { x: -.3, y: .2 } satisfies ReefTarget;
const snapshot: Readonly<TidalKiteSnapshot> = alternative.getReef();
const accepted: boolean = alternative.invite(target);
const disposed: boolean = alternative.disposed;
alternative.bank(-1); alternative.showReefStill('invite'); alternative.setReef({ duration: 40 });
alternative.setOptions({ palette: 'lagoon', reducedMotion: 'ignore' });
alternative.setDirector(null); alternative.advance(1 / 60); alternative.restart(); alternative.resize();
alternative.play(); alternative.pause(); alternative.dispose(); renderer.destroy(); instance.dispose();
void [snapshot, accepted, disposed];

// Original and the strict public package facade retain their established types.
const original = createMantaReef(canvas); original.showReefStill('glide'); original.bank(1); original.destroy();
const packageOptions = { species: 'manta', scene: 'reactive', autoStart: false } satisfies ArtworkOptions;
const publicArtwork = createArtwork(canvas, packageOptions); publicArtwork.pause(); publicArtwork.dispose();

// @ts-expect-error Only one manta belongs to this private study.
alternative.setOptions({ count: 2 });
// @ts-expect-error The alternative may not change species.
createMantaTidalKite(canvas, {}, { species: 'octopus' });
// @ts-expect-error The private director cannot be combined with shared scene control.
alternative.setDirector({ scene: 'upwelling-ballet' });
// @ts-expect-error The study uses its local reef route.
alternative.setOptions({ scene: 'swimby' });
// @ts-expect-error Bank direction is explicit.
alternative.bank(0);
// @ts-expect-error Invitation coordinates are both required.
alternative.invite({ x: .2 });
// @ts-expect-error Invitation coordinates are numeric.
alternative.invite({ x: '.2', y: 0 });
// @ts-expect-error Still names describe authored poses.
alternative.showReefStill('jump');
// @ts-expect-error Snapshots cannot mutate the live state.
snapshot.busy = false;
// @ts-expect-error Target snapshots are immutable as well.
if (snapshot.invitationTarget) snapshot.invitationTarget.x = 0;
// @ts-expect-error Original does not gain the alternative's invitation still.
original.showReefStill('invite');
// @ts-expect-error The alternative stays out of the public package options.
createArtwork(canvas, { species: 'manta', variation: 'tidal-kite' });
