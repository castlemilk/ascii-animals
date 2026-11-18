import {
  CuttlefishArtwork, createMarineDirector, normalizeMarineDirector,
} from '../src/animals/cuttlefish.js';
import { createMarineDirector as createFromMarineEntry } from 'ascii-animals-review/cuttlefish';

// Verify the unchanged package subpath resolves the generated declaration too.
const packagedFactory: typeof createMarineDirector = createFromMarineEntry;
void packagedFactory;

declare const canvas: HTMLCanvasElement;
const config = normalizeMarineDirector({
  scene: 'reef-rendezvous', duration: 40, current: -.5, spread: 1.2,
  intimacy: .9, autonomy: .7, focus: 2, roles: ['guide', 'forager', 'sentinel'], backdrop: true,
});
const scene: 'reef-rendezvous' | 'upwelling-ballet' | 'tidepool-investigation' = config.scene;
const artwork: CuttlefishArtwork = createMarineDirector(canvas, config, {
  count: 3, speciesByAnimal: ['manta', 'octopus', 'cuttlefish'], autoStart: false,
  reducedMotion: 'system', maxCells: 4096,
});
artwork.setDirector({ scene: 'upwelling-ballet' });
artwork.cueDirector({ type: 'invite', x: .25, y: -.2 });
artwork.cueDirector({ type: 'release' });
artwork.cueDirector({ type: 'disturb', id: 2 });
artwork.cueDirector({ type: 'disturb' });
artwork.showDirectorStill('explore');
const snapshot = artwork.getDirector();
const chapter: 'arrive' | 'engage' | 'explore' | 'depart' | null = snapshot.chapter;
const enabled: boolean = snapshot.enabled;
const time: number = snapshot.time;
snapshot.members.forEach(member => {
  const id: number = member.id;
  const species: 'cuttlefish' | 'manta' | 'octopus' = member.species;
  const motive: string = member.motive;
  void [id, species, motive];
});
artwork.setDirector(null);
artwork.restart(); artwork.setPaused(true); artwork.destroy();
void [scene, chapter, enabled, time];

// @ts-expect-error Unknown authored scene.
normalizeMarineDirector({ scene: 'school' });
// @ts-expect-error Director values have explicit numeric types.
normalizeMarineDirector({ duration: '40' });
// @ts-expect-error Unknown option keys are rejected at runtime and type level.
normalizeMarineDirector({ unboundedAnimals: true });
// @ts-expect-error A director role is distinct from the inherited marine role union.
normalizeMarineDirector({ roles: ['cruise'] });
// @ts-expect-error Nested normalized role list is immutable.
config.roles.push('guide');
// @ts-expect-error Normalized configuration is immutable.
config.duration = 35;
// @ts-expect-error Invalid input cue discriminator.
artwork.cueDirector({ type: 'teleport' });
// @ts-expect-error Invitation requires both normalized coordinates.
artwork.cueDirector({ type: 'invite', x: .2 });
// @ts-expect-error Numeric input coordinate required.
artwork.cueDirector({ type: 'invite', x: 'left', y: 0 });
// @ts-expect-error Release does not accept an unrelated target ID.
artwork.cueDirector({ type: 'release', id: 2 });
// @ts-expect-error Chapter names are a closed authored-scene vocabulary.
artwork.showDirectorStill('spray');
// @ts-expect-error Existing artwork options remain separately typed.
createMarineDirector(canvas, {}, { species: 'fox' });
// @ts-expect-error Existing root-style construction does not acquire a director option.
new CuttlefishArtwork(canvas, { director: config });
