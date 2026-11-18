/** Compile-only public-facade consumers. No generated species-only shortcut. */
import {
  createFrogArtwork, createFrogPond, configureFrogDirector, stepFrogPond,
  resetFrogPond, selectPondFrog, setPondRole, posePondFrog,
} from '../../../lib/public/frog.js';
import type {
  FrogArtwork, FrogDirectorOptions, FrogDirectorConfig, FrogPondRoles,
  FrogPondState, FrogPondActor, FrogPondAction, FrogPondInput,
  FrogPondMotive, FrogPondStepResult, FrogState,
} from '../../../lib/public/frog.js';

type Assert<T extends true> = T;
type NotAny<T> = 0 extends (1 & T) ? false : true;
export type PondHasNoAny = Assert<NotAny<ReturnType<typeof createFrogPond>>>;
export type ActorHasNoAny = Assert<NotAny<ReturnType<typeof createFrogPond>['actors'][number]>>;
export type ModelHasNoAny = Assert<NotAny<FrogPondActor['model']>>;
export type DirectorHasNoAny = Assert<NotAny<ReturnType<typeof configureFrogDirector>>>;
export type PublicMountHasNoAny = Assert<NotAny<ReturnType<typeof createFrogArtwork>>>;
export type CallbackHasNoAny = Assert<NotAny<NonNullable<Parameters<typeof createFrogArtwork>[1]>['onPondChange']>>;

const roles: FrogPondRoles = ['caller', 'hunter', 'dreamer'];
const director: FrogDirectorOptions = { scene: 'moonlit-chorus', count: 3, layout: 'arc', tempo: .8, autonomy: true, roles };
const config: FrogDirectorConfig = configureFrogDirector(director);
const pond: FrogPondState = createFrogPond({ seed: 23, config: { jumpHeight: .8 }, director });
const inputs: readonly FrogPondInput[] = [
  { type: 'select', frogId: 1, tick: 1, seq: 0 },
  { type: 'hunt', frogId: 1, x: .3, y: -.1, tick: 1, seq: 1 },
  { type: 'ripple', x: -.3, y: .2, tick: 1, seq: 2 },
];
const result: FrogPondStepResult = stepFrogPond(pond, 1, inputs);
const next: FrogPondState = resetFrogPond(setPondRole(selectPondFrog(result.state, 0), 0, 'hunter'), { director: { count: 2 } });
const actor: FrogPondActor = next.actors[0]!;
const model: FrogState = actor.model;
const pose = posePondFrog(next, actor, { motion: false, pondStill: 'call' });

declare const canvas: HTMLCanvasElement;
const artwork: FrogArtwork = createFrogArtwork(canvas, {
  seed: 9, paused: true, director,
  frameSource: { subscribe(callback) { callback(100); return () => {}; } },
  onPondChange(state) { const typed: FrogPondState = state; const tick: number = typed.tick; void tick; },
});
artwork.updateDirector({ scene: 'stillwater', layout: 'shelter' });
artwork.selectFrog(1); artwork.setRole(1, 'caller'); artwork.call();
artwork.hunt({ x: .5, y: 0 }); artwork.ripple(); artwork.target({ x: .2, y: .1 }); artwork.leap();
artwork.pause(); artwork.restart(); artwork.update({ size: .9 }); artwork.play();
const maybePond: FrogPondState | null = artwork.getPondState();
if (maybePond) { const id: number = maybePond.selectedId; void id; }
const selected: FrogState = artwork.getState(); artwork.dispose();

export function motive(m: FrogPondMotive): number {
  switch (m.kind) {
    case 'rest': return m.age;
    case 'listen': return m.duration + m.point.x;
    case 'call': return Number(m.reply) + m.duration;
    case 'track': return (m.padId ?? 0) + m.point.y;
    case 'hop': return m.age + m.point.x;
    case 'strike': return m.duration + m.point.x;
    case 'settle': return m.duration;
    default: { const exhaustive: never = m; return exhaustive; }
  }
}
export function action(a: FrogPondAction): number {
  switch (a.type) {
    case 'target': case 'ripple': return a.x + a.y;
    case 'select': case 'call': return a.frogId;
    case 'hop': return a.frogId + a.padId;
    case 'hunt': return a.frogId + a.x + a.y;
    case 'leave': return 0;
    default: { const exhaustive: never = a; return exhaustive; }
  }
}

// A permissive any surface makes these unused and fails this fixture.
// @ts-expect-error Count is the declared one-to-three population, not arbitrary.
configureFrogDirector({ count: 4 });
// @ts-expect-error No legacy marine scene names.
createFrogArtwork(canvas, { director: { scene: 'encounter' } });
// @ts-expect-error No arbitrary custom role strings.
configureFrogDirector({ roles: ['caller', 'bird', 'dreamer'] });
// @ts-expect-error Stable ID role tuple always has exactly three entries.
configureFrogDirector({ roles: ['caller'] });
// @ts-expect-error Director booleans do not coerce strings.
configureFrogDirector({ autonomy: 'false' });
// @ts-expect-error No undeclared director settings.
artwork.updateDirector({ frequency: 10 });
// @ts-expect-error Body configuration remains separate from director options.
artwork.update({ count: 3 });
// @ts-expect-error IDs are numeric.
artwork.selectFrog('1');
// @ts-expect-error Unsupported roles are rejected at the public boundary.
artwork.setRole(0, 'fox');
// @ts-expect-error Hunt target needs normalized numeric coordinates.
artwork.hunt({ x: '0', y: 0 });
// @ts-expect-error Omitted target is supported; explicit null is not a Vec2.
artwork.hunt(null);
// @ts-expect-error Ripple shares the same strict normalized target contract.
artwork.ripple(null);
// @ts-expect-error Events require explicit next tick and sequence.
stepFrogPond(pond, 1, [{ type: 'call', frogId: 0 }]);
// @ts-expect-error Hop input needs its pad identifier.
stepFrogPond(pond, 1, [{ type: 'hop', frogId: 0, tick: 1, seq: 0 }]);
// @ts-expect-error Call is routed to a frog and has no invented pad field.
stepFrogPond(pond, 1, [{ type: 'call', frogId: 0, padId: 0, tick: 1, seq: 0 }]);
// @ts-expect-error Unknown scene event discriminants cannot enter replay.
stepFrogPond(pond, 1, [{ type: 'swim', tick: 1, seq: 0 }]);
// @ts-expect-error Scene state is readonly.
pond.tick = 4;
// @ts-expect-error Nested model state is readonly.
actor.model.position.x = 0;
// @ts-expect-error Population snapshots cannot be mutated.
pond.actors.push(actor);
// @ts-expect-error Social replies may never be generation two.
const recursiveReply: FrogPondState['replies'][number] = { frogId: 1, sourceId: 0, dueTick: 10, generation: 2 };
// @ts-expect-error Hop motives must identify purpose and target.
const invalidMotive: FrogPondMotive = { kind: 'hop', age: 1 };
// @ts-expect-error Director callbacks are typed with pond state.
createFrogArtwork(canvas, { director: {}, onPondChange(state: string) { return state; } });
// @ts-expect-error Explicit undefined config field is not an omitted patch key.
configureFrogDirector({ count: undefined });
// @ts-expect-error Static pond alternatives are finite and named.
posePondFrog(pond, actor, { pondStill: 'party' });

void [config, model, pose, selected, recursiveReply, invalidMotive];
