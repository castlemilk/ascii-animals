import {
  createTurtleArtwork as fromRoot,
  createTurtleModel as modelFromRoot,
  TURTLE_DEFAULTS as defaultsFromRoot,
  type TurtleScene,
  type TurtleRole,
  type TurtleReaction,
  type TurtleOptions,
  type TurtleCell,
  type TurtleModel
} from '../../../lib/index.js';
import { createTurtleArtwork, createTurtleModel, normalizeTurtleOptions } from '../../../lib/public/turtle.js';

declare const canvas: HTMLCanvasElement;
declare const container: HTMLElement;
const scene: TurtleScene = 'reef-passage';
const role: TurtleRole = 'forager';
const options: TurtleOptions = {
  scene, count: 3, route: 'channel', director: 'hold', current: -.4,
  arrivalSeconds: 8, lingerSeconds: 20, departureSeconds: 12,
  individuals: [{ id: 1, label: 'Moss', role, size: .9, interest: .7 }],
  showLabels: true, showRoute: true, reducedMotion: 'system'
};
const model: TurtleModel = createTurtleModel(options);
model.configure({ spacing: 1.1, depth: .7 });
model.configure({ route: 'arc' }, true);
model.direct('blue-drift'); model.stage('linger'); model.select(1);
model.inspect(.2, -.1, 1); model.guide(.4, .2); model.clearGuide();
model.advanceTicks(120); model.greet(true); model.reset();
const text: string = model.frame().text;
const legacyCell: TurtleCell = { glyph: '#', tone: 8 };
const owner: number | null | undefined = model.frame().cells[0]?.ownerId;
const art = createTurtleArtwork(canvas, { ...options, frameSource: { subscribe() { return () => {}; } } });
art.direct(scene); art.select(2); art.inspect(0, .2); art.stage('departure');
art.update({ current: .5 }); art.pause(); art.pulse(); art.restart();
const unsubscribe: () => void = art.subscribe(status => { const act: string = status.act; void act; });
unsubscribe(); art.dispose(); fromRoot(canvas, options).dispose();
modelFromRoot(options).frame(); normalizeTurtleOptions(options); void defaultsFromRoot; void text; void legacyCell; void owner;

function reactionProgress(reaction: TurtleReaction): number {
  if (reaction.kind === 'none') {
    // @ts-expect-error No progress exists before a reaction.
    reaction.progress;
    return 0;
  }
  return reaction.progress;
}
reactionProgress(model.getDirectorState().members[0]!.reaction);

// @ts-expect-error Turtle artwork remains a Canvas API, unlike the Owl DOM host.
createTurtleArtwork(container);
// @ts-expect-error Unknown scene cannot silently select a preset.
model.direct('school');
// @ts-expect-error Unknown route rejects at the API boundary.
model.configure({ route: 'spiral' });
// @ts-expect-error Unrelated species behaviors do not leak into this API.
model.configure({ behavior: 'pounce' });
// @ts-expect-error Roles are a closed species-local union.
model.configure({ individuals: [{ id: 0, role: 'hunter' }] });
// @ts-expect-error Stages are the authored three-part arc.
art.stage('rest');
// @ts-expect-error Normalized pointer coordinates are numbers.
art.inspect('left', 0);
// @ts-expect-error Integer identity is not a display label.
art.select('Moss');
// @ts-expect-error Unknown director mode is rejected.
createTurtleModel({ director: 'automatic' });
// @ts-expect-error Explicit optional-property validation rejects undefined in TS callers.
createTurtleModel({ count: undefined });
// @ts-expect-error Snapshot identities cannot be mutated.
model.getDirectorState().members[0]!.role = 'drifter';
// @ts-expect-error Config override arrays are immutable.
model.getOptions().individuals.push({ id: 0 });
// @ts-expect-error Frame-source subscription must return an unsubscribe function.
createTurtleArtwork(canvas, { frameSource: { subscribe() {} } });
