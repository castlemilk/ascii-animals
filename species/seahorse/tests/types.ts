import {
  createSeahorseArtwork,
  createSeahorseModel,
  normalizeSeahorseOptions,
  type SeahorseOptions
} from '../../../lib/public/seahorse.js';

const options = {
  scene: 'kelp-garden', count: 3, choreography: 'hold', duration: 28,
  stagger: .8, current: -.4, labels: true, behavior: 'holdfast',
  individuals: [
    { role: 'sentinel', scale: .85, facing: 'left' },
    { role: 'explorer', scale: 1.1, facing: 'right' },
    { role: 'dreamer' }
  ]
} as const satisfies SeahorseOptions;
const model = createSeahorseModel(options);
const normalized = normalizeSeahorseOptions(options);
const art = createSeahorseArtwork(document.createElement('canvas'), {
  ...options,
  frameSource: { subscribe: callback => { callback(0); return () => {}; } }
});
type Action = Parameters<typeof model.direct>[0];
const actions: readonly Action[] = [
  { type: 'select', id: 0 }, { type: 'release' }, { type: 'anchor', id: 1 },
  { type: 'inspect' }, { type: 'startle', id: 2 }, { type: 'seek', progress: .4 }
];
for (const action of actions) { model.direct(action, true); art.direct(action); }
model.clearGuide(); art.clearGuide();
art.update({ scene: 'tidal-duet', count: 2, individuals: [{ role: 'partner' }, { role: 'partner' }] });
art.update({ scene: 'drift-passage', choreography: 'cycle', current: 1 });
const snapshot = model.getDirectorState();
const scene: 'study' | 'kelp-garden' | 'tidal-duet' | 'drift-passage' = snapshot.scene;
const arc: 'arrival' | 'rest' | 'depart' | 'return' = snapshot.arc;
const sameSnapshot: typeof snapshot = art.getDirectorState();
for (const member of snapshot.members) {
  const motive: 'arriving' | 'anchored' | 'drifting' | 'inspecting' | 'startled' | 'recovering' | 'duet' | 'returning' = member.motive.kind;
  const point: Readonly<{ x: number; y: number }> = member.tailTip;
  if (member.anchor !== null) { const attachment: number = member.anchor.x; void attachment; }
  void motive; void point;
}

// @ts-expect-error scene names are species-specific
createSeahorseModel({ scene: 'procession' });
// @ts-expect-error count is numeric
art.update({ count: 'four' });
// @ts-expect-error choreography has an explicit supported set
art.update({ choreography: 'loop' });
// @ts-expect-error individual roles are not arbitrary strings
art.update({ individuals: [{ role: 'school-leader' }] });
// @ts-expect-error individual patches reject undeclared properties
art.update({ individuals: [{ color: 'red' }] });
// @ts-expect-error individual facing has a closed union
art.update({ individuals: [{ facing: 'up' }] });
// @ts-expect-error a select command needs a member ID
model.direct({ type: 'select' });
// @ts-expect-error a seek command needs normalized progress
model.direct({ type: 'seek' });
// @ts-expect-error IDs are numeric
art.direct({ type: 'inspect', id: 'sentinel' });
// @ts-expect-error commands are a discriminated union
model.direct({ type: 'ink' });
// @ts-expect-error irrelevant payloads do not belong to release commands
model.direct({ type: 'release', progress: .5 });
// @ts-expect-error browser policy chooses posters; consumers do not bypass it with a second argument
art.direct({ type: 'release' }, true);
// @ts-expect-error director snapshots are immutable
snapshot.progress = .5;
// @ts-expect-error members arrays are immutable
snapshot.members.push(snapshot.members[0]!);
// @ts-expect-error members are immutable
snapshot.members[0]!.x = 0;
// @ts-expect-error nested tail positions are immutable
snapshot.members[0]!.tailTip.x = 0;
// @ts-expect-error normalized individual arrays are immutable
normalized.individuals.push({ role: 'sentinel' });
// @ts-expect-error normalized individuals are immutable
normalized.individuals[0]!.role = 'dreamer';
// @ts-expect-error marine rendering contracts remain unsupported
art.update({ formation: 'diagonal', ink: true });

void scene; void arc; void sameSnapshot;
