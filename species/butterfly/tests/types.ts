import {
  createButterflyArtwork,
  createButterflyModel,
  normalizeButterflyOptions,
  type ButterflyOptions,
  type ButterflyPhase,
} from '../../../lib/public/butterfly.js';

// The legacy literal union and creation/input methods remain valid.
const phases: Record<ButterflyPhase, string> = {
  idle: 'Idle', approach: 'Approaching', display: 'Wings open', settle: 'Settling',
};
const legacy = createButterflyModel({ behavior: 'curious', facing: 'right' });
legacy.guide(.4, -.2);
legacy.greet(true);
legacy.advanceTicks(60);
legacy.reset();
const oldFrame: string = legacy.frame().text;

const options: ButterflyOptions = {
  seed: 73,
  director: {
    scene: 'nectar', count: 4, path: 'ribbon',
    roles: ['forager', 'scout', 'basker', 'wanderer'] as const,
    sceneSeconds: 28, breeze: -.4, spread: 1.1,
    pointerMode: 'attract', showLabels: true,
  },
};
const model = createButterflyModel(options);
model.configure({ director: { path: 'spiral' } });
model.cue('gather');
model.cue('breeze', true);
model.cue('rest');
model.nextAct(true);
model.release();
const garden = model.getGarden();
const scene: 'specimen' | 'morning' | 'nectar' | 'breeze' | 'roost' = garden.scene;
const activity: 'flutter' | 'glide' | 'inspect' | 'nectar' | 'perch' | 'bask' | 'shelter' | 'recover' | undefined = garden.members[0]?.activity.kind;
const label: string = garden.actLabel;

// This function is typechecked, not executed in Node/SSR.
function mount(canvas: HTMLCanvasElement) {
  const art = createButterflyArtwork(canvas, {
    ...options,
    frameSource: { subscribe(callback) { callback(0); return () => {}; } },
  });
  art.pause();
  art.nextAct();
  art.cue('rest');
  art.guide(.2, .3);
  art.release();
  art.update({ director: { count: 6, pointerMode: 'breeze' } });
  const state = art.getGarden();
  art.restart();
  art.dispose();
  return state;
}

// @ts-expect-error Unknown scene is not a supported authored scene.
createButterflyModel({ director: { scene: 'ocean' } });
// @ts-expect-error Marine formations do not become butterfly paths.
model.configure({ director: { path: 'horizontal' } });
// @ts-expect-error Roles are specific to garden behavior.
model.configure({ director: { roles: ['hunter'] } });
// @ts-expect-error Pointer mode is a finite discriminated setting.
model.configure({ director: { pointerMode: 'ink' } });
// @ts-expect-error Cue command names are explicit.
model.cue('explode');
// @ts-expect-error Runtime budgets are numeric options.
model.configure({ director: { count: 'six' } });
// @ts-expect-error Normalized configuration is immutable.
normalizeButterflyOptions().director.count = 2;
// @ts-expect-error Normalized roles are immutable.
normalizeButterflyOptions().director.roles.push('scout');
// @ts-expect-error Garden snapshots are immutable.
garden.members[0]!.x = 1;
// @ts-expect-error Snapshot members cannot be appended by a consumer.
garden.members.push(garden.members[0]!);
// @ts-expect-error Activity state cannot be mutated through a snapshot.
garden.members[0]!.activity.kind = 'flutter';
// @ts-expect-error Canvas is required by the butterfly browser mount.
mount(document.createElement('div'));

void [phases, oldFrame, scene, activity, label, mount];
