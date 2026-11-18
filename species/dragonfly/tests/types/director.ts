import { createDragonflyDirector, validateDragonflyDirectorOptions,
  type DragonflyDirectorOptions, type DragonflyDirectorInput, type DragonflyDirectorState,
  type DragonflyDirectorMember, type DragonflyDirectorPhase, type DragonflyDirector,
  type DragonflyDirectedGeometry, type DragonflyDirectorStepResult } from '../../lib/director.js';
import { mountDragonfly, type DragonflyMountOptions, type DragonflyBrowserStatus } from '../../lib/browser.js';
import { createDragonfly, type DragonflyState } from '../../lib/index.js';

const configuration = {
  count: 4, scene: 'relay', route: 'figure-eight', tempo: .8, spread: .9, scale: .38,
  breeze: -.2, labels: true, roles: ['patroller','sentinel','skimmer','wanderer'],
} satisfies Partial<DragonflyDirectorOptions>;
const validated: Readonly<DragonflyDirectorOptions> = validateDragonflyDirectorOptions(configuration);
const director: DragonflyDirector = createDragonflyDirector(validated,{seed:17,motion:'slow'});
const events: readonly DragonflyDirectorInput[] = [
  {type:'select',tick:1,seq:0,id:2},
  {type:'pointer',tick:1,seq:1,x:.8,y:-.2},
  {type:'cue',tick:1,seq:2,cue:'dart'},
];
const result: DragonflyDirectorStepResult=director.step(1,events);
const state: DragonflyDirectorState=result.state;
const member: DragonflyDirectorMember=state.members[0]!;
const geometry: readonly DragonflyDirectedGeometry[]=director.sample();
const originalModelState: DragonflyState=director.getPrimaryState();

function describePhase(kind: DragonflyDirectorPhase['kind']): string {
  switch(kind) {
    case 'patrol':case 'attention':case 'hover':case 'launch':case 'dart':
    case 'settle':case 'return':case 'land':case 'perched':case 'cooldown':return kind;
    default:{const exhaustive:never=kind;return exhaustive;}
  }
}
describePhase(member.phase.kind);
director.configure({count:2,scene:'attention',route:'orbit'});
director.configureModel({wingAmplitude:.25,trackingAcceleration:2});
director.selectIndividual(1);director.clearTarget();director.setPaused(true);
director.reset(0);director.setStaticPose(1);director.dispose();

const mountOptions: DragonflyMountOptions={
  director:configuration, model:{seed:17,motion:'full'}, view:'oblique',
  frameSource:{subscribe(callback){callback(0);return ()=>{};}},
  onStatus(status: DragonflyBrowserStatus){
    const actorCount:number|undefined=status.director?.members.length;void actorCount;
  },
};
const host=mountDragonfly(document.createElement('canvas'),mountOptions);
host.configureDirector({count:4,labels:false});host.selectIndividual(3);
host.cue('perch');host.cue('return');host.dart();
const ensemble:DragonflyDirectorState|null=host.getDirectorState();
const options:Readonly<DragonflyDirectorOptions>|null=host.getDirectorOptions();
const legacyState:DragonflyState=host.getState();
host.configure({motion:'slow'});host.setPaused(true);host.reset(17);host.dispose();

// @ts-expect-error Scene vocabulary is distinct from legacy cuttlefish scenes.
createDragonflyDirector({scene:'reactive'});
// @ts-expect-error Count never accepts a coercible string.
createDragonflyDirector({count:'4'});
// @ts-expect-error Routes are explicit supported values.
director.configure({route:'random'});
// @ts-expect-error Four roles are required independently of the current count.
director.configure({roles:['patroller','sentinel']});
// @ts-expect-error Each role has a declared vocabulary.
director.configure({roles:['patroller','sentinel','skimmer','guardian']});
// @ts-expect-error Species options have their own update method.
director.configure({wingHz:3});
// @ts-expect-error Director options are not model options.
director.configureModel({count:2});
// @ts-expect-error Seed changes use reset(seed).
director.configureModel({seed:9});
// @ts-expect-error Legacy models do not acquire scene options.
createDragonfly().configure({scene:'relay'});
// @ts-expect-error Pointer inputs require both normalized coordinates.
const missingCoordinate:DragonflyDirectorInput={type:'pointer',tick:2,seq:3,x:.2};
// @ts-expect-error Select inputs require an individual ID.
const missingId:DragonflyDirectorInput={type:'select',tick:2,seq:3};
// @ts-expect-error Cue vocabulary is explicit.
const unknownCue:DragonflyDirectorInput={type:'cue',tick:2,seq:3,cue:'startle'};
// @ts-expect-error A legacy model dart event is not a scene cue.
const legacyEvent:DragonflyDirectorInput={type:'dart',tick:2,seq:3};
// @ts-expect-error Scene member snapshots are readonly.
member.position.x=3;
// @ts-expect-error Returned role configuration is readonly.
validated.roles[0]='sentinel';
// @ts-expect-error Browser model configuration remains backward-compatible.
host.configure({count:4});
// @ts-expect-error Director browser updates do not accept model fields.
host.configureDirector({wingHz:3});
// @ts-expect-error Browser controls use the same cue vocabulary.
host.cue('startle');
// @ts-expect-error Exact optional properties reject an explicitly undefined scene.
director.configure({scene:undefined});
void [geometry,originalModelState,ensemble,options,legacyState,missingCoordinate,missingId,unknownCue,legacyEvent];
