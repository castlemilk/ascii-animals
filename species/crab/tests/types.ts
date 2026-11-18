/**
 * Compile-only consumer contract; never execute this fixture.
 * Build the package first, then run:
 *   node node_modules/typescript/bin/tsc -p species/crab/tests/tsconfig.json
 * Numeric bounds (cast count, duration, current, tide) are runtime validation.
 */
import {
  CRAB_DEFAULTS,
  createCrabArtwork,
  createCrabModel,
  normalizeCrabOptions,
  type CrabArtwork,
  type CrabBeat,
  type CrabFrame,
  type CrabFrameSource,
  type CrabModel,
  type CrabOptions,
  type CrabPhase,
  type CrabStatus,
} from 'ascii-animals-review/crab';
import {
  createCrabModel as createCrabFromRoot,
  type CrabOptions as RootCrabOptions,
} from 'ascii-animals-review';

declare const canvas: HTMLCanvasElement;
declare const frameSource: CrabFrameSource;

// Existing consumer code and legacy names remain valid.
const legacyOptions = {
  columns: 120, rows: 50, seed: 7, speed: 1, scale: 1,
  sway: 0.18, facing: 'left', behavior: 'curious', palette: 'brass',
  paused: false, reducedMotion: 'system',
} satisfies CrabOptions;
const legacyModel: CrabModel = createCrabModel(legacyOptions);
legacyModel.configure({ behavior: 'guard', facing: 'right' });
legacyModel.advanceTicks(60);
legacyModel.guide(-1, 0);
legacyModel.greet(true);
const legacyPhase: CrabPhase = legacyModel.getPhase();
const legacyFrame: CrabFrame = legacyModel.frame();
const legacyTick: number = legacyModel.getState().tick;
const legacyResponseTick: number | null = legacyModel.getState().responseTick;
legacyModel.reset();

const legacyArtwork: CrabArtwork = createCrabArtwork(canvas, { ...legacyOptions, frameSource });
legacyArtwork.update({ palette: 'lagoon', reducedMotion: 'ignore' });
legacyArtwork.play();
legacyArtwork.pause();
legacyArtwork.pulse();
legacyArtwork.guide(1, 0);
legacyArtwork.restart();
legacyArtwork.resize();
const legacyStatus: CrabStatus = legacyArtwork.getStatus();
const legacySpecies: 'crab' = legacyArtwork.species;
const legacyCanvas: HTMLCanvasElement = legacyArtwork.canvas;

// The typed subpath and root share the same options contract.
const theatreOptions = {
  scene: 'forage', count: 3, formation: 'terraces', director: 'auto',
  actDuration: 360, tide: 0.3, current: -0.4, labels: true,
  cast: [
    { role: 'curious', label: 'Pip', size: 1 },
    { role: 'shy', label: 'Pebble', size: 0.8 },
    { role: 'territorial', label: 'Captain', size: 1.1 },
  ],
} as const satisfies CrabOptions;
const rootOptions: RootCrabOptions = theatreOptions;
const theatre: CrabModel = createCrabFromRoot(rootOptions);
const normalized = normalizeCrabOptions(theatreOptions);
const fixedCast: NonNullable<CrabOptions['cast']> = theatreOptions.cast;
theatre.configure({ director: 'manual', cast: fixedCast, formation: 'shoreline' });
theatre.configure({ scene: 'signals', formation: 'arc', labels: false });
theatre.configure({ scene: 'tide', count: 5, current: 1, tide: 1 });
theatre.configure({ scene: 'study', count: 1 });

const allBeats: readonly CrabBeat[] = [
  'arrive', 'forage', 'signal', 'challenge', 'retreat', 'shelter', 'return',
];
for (const beat of allBeats) theatre.setBeat(beat, true);
theatre.nextBeat(true);
theatre.clearGuide();
theatre.cue('forage');
theatre.cue('signal');
theatre.cue('shelter');

const member = theatre.getScene().actors[0];
if (member) {
  theatre.select(member.id);
  theatre.cue('signal', member.id);
  const progress: number = member.behavior.progress;
  const behavior = member.behavior;
  switch (behavior.kind) {
    case 'rest': case 'scuttle': case 'forage': case 'signal':
    case 'retreat': case 'shelter': case 'return': case 'inspect':
    case 'groom': case 'brace':
      void progress;
      break;
    default: {
      const exhaustive: never = behavior;
      void exhaustive;
    }
  }
}

const art = createCrabArtwork(canvas, theatreOptions);
art.setBeat('signal');
art.nextBeat();
art.clearGuide();
art.cue('forage');
const displayedMember = art.getScene().actors[0];
if (displayedMember) {
  art.select(displayedMember.id);
  art.cue('shelter', displayedMember.id);
}
const unsubscribe: () => void = art.subscribe(status => {
  const typedStatus: CrabStatus = status;
  const tick: number = status.tick;
  void typedStatus;
  void tick;
});
unsubscribe();
art.dispose();
legacyArtwork.dispose();

// Unknown settings and invalid discriminants fail at the public boundary.
// @ts-expect-error Unknown scene name.
createCrabModel({ scene: 'school' });
// @ts-expect-error Unknown individual role.
createCrabModel({ cast: [{ role: 'leader' }] });
// @ts-expect-error Labels are strings, not numbers.
createCrabModel({ cast: [{ label: 42 }] });
// @ts-expect-error Size is numeric.
createCrabModel({ cast: [{ size: 'large' }] });
// @ts-expect-error Unsupported formation.
createCrabModel({ formation: 'spiral' });
// @ts-expect-error Unsupported director mode.
createCrabModel({ director: 'random' });
// @ts-expect-error Counts are numeric, range checking is runtime.
createCrabModel({ count: 'three' });
// @ts-expect-error Duration is numeric integer ticks at runtime.
createCrabModel({ actDuration: 'seconds' });
// @ts-expect-error Visibility of labels is boolean.
createCrabModel({ labels: 'yes' });
// @ts-expect-error Crab does not expose a marine school option.
createCrabModel({ schoolSize: 3 });
// @ts-expect-error Legacy behavior remains closed.
legacyModel.configure({ behavior: 'swim' });
// @ts-expect-error Unknown cue.
theatre.cue('ink');
// @ts-expect-error Unknown authored beat.
theatre.setBeat('dance');
// @ts-expect-error Model ticks are a numeric count, not elapsed-time objects.
theatre.advanceTicks({ seconds: 1 });
// @ts-expect-error Browser instance requires a canvas, not a DOM text host.
createCrabArtwork(document.createElement('div'));
// @ts-expect-error Subscription callback receives CrabStatus, not a number.
art.subscribe((tick: number) => void tick);
// @ts-expect-error Resolved settings are immutable.
normalized.count = 1;
// @ts-expect-error Defaults are immutable.
CRAB_DEFAULTS.speed = 2;
// @ts-expect-error The frame text is an immutable snapshot.
legacyFrame.text = '';
// @ts-expect-error Actor snapshots are readonly.
theatre.getScene().actors.push(member);

void [legacyPhase, legacyTick, legacyResponseTick, legacyStatus, legacySpecies, legacyCanvas];
