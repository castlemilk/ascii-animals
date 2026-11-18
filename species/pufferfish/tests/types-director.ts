/** Positive and intentional-error fixtures for the opt-in director declarations. */
import {
  createPufferfishDirector, resolvePufferfishDirectorOptions, configurePufferfishDirector,
  resetPufferfishDirector, selectPufferfishActor, stepPufferfishDirector, pufferfishDirectorPoster, describePufferfishDirector,
} from '../build/director.js';
import type {
  PufferfishDirectorOptions, PufferfishDirectorConfig, PufferfishDirectorState,
  PufferfishDirectorEvent, PufferfishDirectorResult, PufferfishSceneBeat, PufferfishRole,
} from '../build/director-types.js';
import { mountPufferfish } from '../build/controller.js';
import type { PufferfishController, PufferfishFrameSource } from '../build/controller.js';
import type { PufferfishLegacyDependency } from '../build/legacy-painter.js';
import { createPufferfishPainter } from '../build/legacy-painter.js';
import { createPufferfishArtwork, createPufferfishDirector as createPublicDirector } from 'ascii-animals-review/pufferfish';

const options = {
  scene: 'reef', count: 3, tempo: 1.2, current: -0.5, curiosity: 0.6, spacing: 1,
  size: 0.9, labels: true, roles: ['explorer', 'sentinel', 'drifter'],
} satisfies PufferfishDirectorOptions;
const config: PufferfishDirectorConfig = resolvePufferfishDirectorOptions(options);
const initial: PufferfishDirectorState = createPufferfishDirector(config, { seed: 23 });
const event: PufferfishDirectorEvent = { tick: 1, seq: 0, type: 'invite', x: 0.2, y: -0.3 };
const result: PufferfishDirectorResult = stepPufferfishDirector(initial, { tick: 1, events: [event] });
const reset: PufferfishDirectorState = resetPufferfishDirector(result.state, 19);
const selected: PufferfishDirectorState = selectPufferfishActor(reset, 1);
const configured: PufferfishDirectorState = configurePufferfishDirector(reset, { scene: 'current', count: 2 });
const poster: PufferfishDirectorState = pufferfishDirectorPoster(configured, true);
const description: string = describePufferfishDirector(poster);
const reacted: readonly number[] = result.reacted;
const role: PufferfishRole | undefined = initial.actors[0]?.role;
void description; void reacted; void role; void selected;

function sceneNarrowing(beat: PufferfishSceneBeat): string {
  switch (beat.scene) {
    case 'reef': { const kind: 'discover' | 'inspect' | 'gather' | 'rest' = beat.kind; return kind; }
    case 'current': { const kind: 'rising' | 'shelter' | 'returning' | 'slack' = beat.kind; return kind; }
    case 'shadow': { const kind: 'watch' | 'shadow' | 'release' | 'resume' = beat.kind; return kind; }
    default: { const unreachable: never = beat; return unreachable; }
  }
}
sceneNarrowing(initial.beat);

declare const canvas: HTMLCanvasElement;
declare const legacy: PufferfishLegacyDependency;
declare const frameSource: PufferfishFrameSource;
const controller: PufferfishController = mountPufferfish(canvas, legacy, {
  director: options, species: { seed: 23 }, render: { mode: 'ascii', quality: 'fine' }, frameSource,
});
controller.configureDirector({ scene: 'shadow' });
controller.selectActor(1); controller.invite(); controller.invite(0.25, -0.3);
controller.approach(); controller.retreat(); controller.reset();
const snapshot: PufferfishDirectorState | null = controller.getDirectorSnapshot();
const count: number | undefined = controller.getStatus().director?.count;
const presentedRole: PufferfishRole | undefined = controller.getStatus().director?.actors[0]?.role;
const painter = createPufferfishPainter(canvas, legacy, { mode: 'points' });
painter.resize(900, 506, 2);
const frame = painter.drawScene(initial);
const sceneScale: number = frame.sceneScale;
const target: number | null = painter.hitActor(0.2, -0.3);
void snapshot; void count; void target; void presentedRole; void sceneScale;

// The actual current package subpath must expose the same opt-in API and old aliases.
const publicScene: PufferfishDirectorState = createPublicDirector(options, { seed: 23 });
const artwork = createPufferfishArtwork(canvas, { director: options, species: { seed: 23 }, paused: true });
artwork.configureDirector({ scene: 'current' }); artwork.selectActor(1); artwork.invite(0.2, -0.2);
artwork.update({ wobble: 0.2 }); artwork.pause(); artwork.play(); artwork.pulse(); artwork.restart();
const baseSeed: number = artwork.getOptions().seed;
const publicSnapshot: PufferfishDirectorState | null = artwork.getDirectorSnapshot();
artwork.dispose(); void baseSeed; void publicSnapshot; void publicScene;

// @ts-expect-error Unknown scene identifiers are not accepted.
createPufferfishDirector({ scene: 'deep-ocean' });
// @ts-expect-error Unknown director keys are rejected.
createPufferfishDirector({ randomize: true });
// @ts-expect-error Population requires numeric input; ranges are checked at runtime.
createPufferfishDirector({ count: '3' });
// @ts-expect-error Director roles use explicit string values.
createPufferfishDirector({ roles: ['explorer', 'crab'] });
// @ts-expect-error Exact optional properties do not accept explicit undefined fields.
createPufferfishDirector({ tempo: undefined });
// @ts-expect-error Selection requires a numeric actor identity.
stepPufferfishDirector(initial, { tick: 1, events: [{ tick: 1, seq: 0, type: 'select', id: '1' }] });
// @ts-expect-error Pointer events require their CSS aspect value.
stepPufferfishDirector(initial, { tick: 1, events: [{ tick: 1, seq: 0, type: 'pointer', x: 0, y: 0 }] });
// @ts-expect-error Invite events require normalized coordinates.
stepPufferfishDirector(initial, { tick: 1, events: [{ tick: 1, seq: 0, type: 'invite' }] });
// @ts-expect-error Director events do not permit generic marine startle input.
stepPufferfishDirector(initial, { tick: 1, events: [{ tick: 1, seq: 0, type: 'startle' }] });
// @ts-expect-error Null event batches are invalid.
stepPufferfishDirector(initial, { tick: 1, events: null });
// @ts-expect-error Scene beats are discriminated by their scene.
const incorrectBeat: PufferfishSceneBeat = { scene: 'reef', kind: 'shadow', progress: 0 };
// @ts-expect-error Actor lists are immutable snapshots.
initial.actors.push(initial.actors[0]!);
// @ts-expect-error Actor positions cannot be mutated through a snapshot.
initial.actors[0]!.x = 0;
// @ts-expect-error Attention is immutable nested state.
initial.actors[0]!.gaze.y = 0;
// @ts-expect-error Role arrays are immutable.
initial.config.roles[0] = 'drifter';
// @ts-expect-error Scene time is not externally mutable.
initial.sceneTick = 100;
// @ts-expect-error Result actor identifiers cannot be appended to immutable replay output.
result.reacted.push(1);
// @ts-expect-error Presented summaries are immutable independently of raw simulation snapshots.
controller.getStatus().director!.actors[0]!.threat = 0;
// @ts-expect-error Render metrics are immutable observations.
frame.sceneScale = 1;
// @ts-expect-error Species options and director options are separate configuration domains.
controller.configure({ scene: 'reef' });
// @ts-expect-error Renderer mode is an explicit enum.
controller.configureRender({ mode: 'pixels' });
// @ts-expect-error Controller does not expose the private shared raster buffer.
controller.owners;
// @ts-expect-error Population belongs to director options rather than invented shared factory fields.
createPufferfishArtwork(canvas, { count: 3 });
// @ts-expect-error Public factory base configuration is an immutable snapshot.
artwork.getOptions().seed = 4;
void incorrectBeat;
