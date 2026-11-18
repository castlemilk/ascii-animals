/** Gecko-only wall choreography. No DOM, clock, random source or scheduler. */
import { createGecko, DEFAULT_GECKO_OPTIONS, resolveGeckoOptions } from './gecko.js';
import type { GeckoEvent, GeckoModel, GeckoOptions, GeckoOptionsPatch, GeckoState, Vec2 } from './types.js';

export type GeckoScene = 'moonlit-wall' | 'lantern-hunt' | 'passing-shadow';
export type GeckoRole = 'scout' | 'hunter' | 'sentry';
export type GeckoIndividualId = 'mica' | 'pip' | 'slate';
export type GeckoMotive = 'explore' | 'inspect' | 'stalk' | 'poise' | 'strike' | 'shelter' | 'return' | 'watch' | 'yield' | 'retreat';
export type GeckoEmotion = 'curious' | 'focused' | 'wary' | 'content';
export interface GeckoDirectorOptions {
  readonly scene: GeckoScene;
  /** Integer1..3. Surviving IDs and contacts are preserved. Default3. */
  readonly population: number;
  /** .4..1.6. Score tempo and animal pace multiplier. Default1. */
  readonly tempo: number;
  /** 0..1. Interest duration and shadow sensitivity. Default.55. */
  readonly boldness: number;
  readonly reverse: boolean;
  readonly showRoutes: boolean;
  readonly autonomy: boolean;
  /** One to three role assignments, missing slots use the original defaults. */
  readonly roles: readonly GeckoRole[];
}
export type GeckoDirectorOptionsPatch = Partial<GeckoDirectorOptions>;
export interface GeckoDirectorConfig {
  readonly seed?: number;
  readonly heading?: number;
  readonly options?: GeckoDirectorOptionsPatch;
  readonly animal?: GeckoOptionsPatch;
}
/** Director owns member habitats; reset only seed and optional common heading. */
export interface GeckoDirectorReset { readonly seed?:number; readonly heading?:number }
interface ArcTiming { readonly beatIndex: number; readonly progress: number; readonly cycle: number; readonly scoreTick: number }
export type GeckoSceneArc = ArcTiming & (
  | { readonly scene: 'moonlit-wall'; readonly beat: 'emerge' | 'climb' | 'inspect' | 'traverse' | 'perch' }
  | { readonly scene: 'lantern-hunt'; readonly beat: 'notice' | 'stalk' | 'poise' | 'strike' | 'return' }
  | { readonly scene: 'passing-shadow'; readonly beat: 'peek' | 'explore' | 'shadow' | 'shelter' | 'return' | 'settle' }
);
export interface GeckoIndividualState {
  readonly id: GeckoIndividualId;
  readonly label: string;
  readonly role: GeckoRole;
  /** Constant placement scale: stance contacts are never translated by a scene transform. */
  readonly scale: number;
  readonly body: GeckoState;
  readonly motive: GeckoMotive;
  readonly emotion: GeckoEmotion;
  readonly tailExpression: number;
  readonly blink: boolean;
  readonly route: readonly Vec2[];
  readonly routeIndex: number;
  readonly goal: Vec2 | null;
  readonly cooldown: number;
  readonly catches: number;
}
export interface GeckoDirectorState {
  readonly version: 1;
  readonly seed: number;
  readonly tick: number;
  readonly lastSequence: number;
  readonly options: Readonly<GeckoDirectorOptions>;
  readonly arc: GeckoSceneArc;
  readonly selectedId: GeckoIndividualId | null;
  readonly pointer: Vec2 | null;
  readonly moth: { readonly position: Vec2; readonly visible: boolean; readonly caughtBy: GeckoIndividualId | null };
  readonly shadow: { readonly active: boolean; readonly progress: number; readonly position: Vec2 };
  readonly individuals: readonly GeckoIndividualState[];
  readonly lastAction: GeckoDirectorReceipt | null;
}
export type GeckoCuePosition = { readonly x:number; readonly y:number } | { readonly x?:never; readonly y?:never };
export type GeckoDirectorCue = { readonly id?: GeckoIndividualId } & GeckoCuePosition &
  { readonly type: 'moth' | 'shadow' | 'return' | 'inspect' };
export type GeckoDirectorEvent = { readonly tick: number; readonly seq: number } & (
  | { readonly type: 'guide'; readonly x: number; readonly y: number; readonly id?: GeckoIndividualId }
  | { readonly type: 'leave' }
  | { readonly type: 'select'; readonly id: GeckoIndividualId | null }
  | GeckoDirectorCue
);
export type GeckoDirectorReceipt =
  | { readonly seq: number; readonly type: GeckoDirectorEvent['type']; readonly outcome: 'applied'; readonly id: GeckoIndividualId | null }
  | { readonly seq: number; readonly type: 'shadow'; readonly outcome: 'ignored'; readonly reason: 'busy'; readonly id: GeckoIndividualId };
export interface GeckoDirectorStepResult { readonly state: GeckoDirectorState; readonly inputs: readonly GeckoDirectorReceipt[] }
export interface GeckoDirectorRecipe {
  readonly version: 1; readonly kind: 'gecko-scene-recipe'; readonly seed: number;
  readonly heading?: number;
  readonly options: Readonly<GeckoDirectorOptions>; readonly animal: Readonly<GeckoOptions>;
  /** Restarts these settings; this is not a serialized current-state checkpoint. */
  readonly startsAtTick: 0;
}
export interface GeckoDirector {
  readonly disposed: boolean;
  step(events?: readonly GeckoDirectorEvent[]): GeckoDirectorStepResult;
  getSnapshot(): GeckoDirectorState;
  update(patch: GeckoDirectorOptionsPatch): Readonly<GeckoDirectorOptions>;
  updateAnimal(patch: GeckoOptionsPatch): Readonly<GeckoOptions>;
  /** Configuration operation; changes selection without advancing simulation. */
  select(id: GeckoIndividualId | null): void;
  reset(options?: GeckoDirectorReset): GeckoDirectorState;
  exportRecipe(): GeckoDirectorRecipe;
  dispose(): void;
}

export const GECKO_DIRECTOR_LIMITS = Object.freeze({ animals: 3, samples: 36_864, maxCols: 256, maxRows: 168,
  eventsPerTick: 32, environmentMarks: 4096, worldWidth: 6.6, worldHeight: 4.4, rootX: 2, rootY: 1 });
const IDS = ['mica', 'pip', 'slate'] as const;
const ROLES = ['scout', 'hunter', 'sentry'] as const;
const SCENES = ['moonlit-wall', 'lantern-hunt', 'passing-shadow'] as const;
export const DEFAULT_GECKO_DIRECTOR_OPTIONS: Readonly<GeckoDirectorOptions> = Object.freeze({
  scene: 'moonlit-wall', population: 3, tempo: 1, boldness: .55, reverse: false,
  showRoutes: false, autonomy: true, roles: Object.freeze([...ROLES]),
});
export const GECKO_SCENES = Object.freeze([
  Object.freeze({ id: 'moonlit-wall', label: 'Moonlit wall', description: 'Three quiet lives follow the seams.', ticks: 1440 }),
  Object.freeze({ id: 'lantern-hunt', label: 'Lantern hunt', description: 'A small light, a long moment of anticipation.', ticks: 1320 }),
  Object.freeze({ id: 'passing-shadow', label: 'Passing shadow', description: 'Notice, shelter, then find courage again.', ticks: 1440 }),
]);
const SCORES = {
  'moonlit-wall': [['emerge',120],['climb',480],['inspect',180],['traverse',480],['perch',180]],
  'lantern-hunt': [['notice',150],['stalk',540],['poise',120],['strike',90],['return',420]],
  'passing-shadow': [['peek',180],['explore',420],['shadow',120],['shelter',180],['return',420],['settle',120]],
} as const;
const HOMES: readonly Vec2[] = [{x:-1.6,y:.68},{x:.05,y:.32},{x:1.62,y:-.28}];
const ROUTES: readonly (readonly Vec2[])[] = [
  [{x:-1.6,y:.68},{x:-1.72,y:-.30},{x:-1.10,y:-.88},{x:-.66,y:-.25},{x:-1.15,y:.40}],
  [{x:.05,y:.32},{x:.54,y:-.14},{x:.30,y:-.79},{x:-.10,y:-.30},{x:.05,y:.65}],
  [{x:1.62,y:-.28},{x:1.52,y:.60},{x:.97,y:.58},{x:.95,y:-.16},{x:1.58,y:-.72}],
];
const SCALES = [1,.94,.88] as const;
const HEADINGS = [-1.3,-.7,2.65] as const;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const copy=(p:Vec2):Vec2=>({x:p.x,y:p.y});
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.y-b.y);
const world=(body:GeckoState,scale:number):Vec2=>({x:body.position.x*scale,y:body.position.y*scale});
const bound=(p:Vec2):Vec2=>({x:clamp(p.x,-2,2),y:clamp(p.y,-1,1)});
const optionsCopy=(o:Readonly<GeckoDirectorOptions>):Readonly<GeckoDirectorOptions>=>({...o,roles:[...o.roles]});
function record(v:unknown,keys:readonly string[],name:string):void {
  if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw new TypeError(`${name} must be a plain object`);
  for(const key of Reflect.ownKeys(v))if(typeof key!=='string'||!keys.includes(key))throw new TypeError(`Unknown ${name} field ${String(key)}`);
}
function finite(v:unknown,lo:number,hi:number,name:string,integer=false):asserts v is number {
  if(typeof v!=='number'||!Number.isFinite(v))throw new TypeError(`${name} must be finite`);
  if(v<lo||v>hi||(integer&&!Number.isSafeInteger(v)))throw new RangeError(`${name} outside ${lo}..${hi}`);
}
export function resolveGeckoDirectorOptions(patch:GeckoDirectorOptionsPatch={},base:Readonly<GeckoDirectorOptions>=DEFAULT_GECKO_DIRECTOR_OPTIONS):Readonly<GeckoDirectorOptions> {
  record(patch,['scene','population','tempo','boldness','reverse','showRoutes','autonomy','roles'],'director');
  const o={...(base===DEFAULT_GECKO_DIRECTOR_OPTIONS?base:resolveGeckoDirectorOptions(base)),...patch};
  // Read present keys explicitly: non-enumerable invalid values must not silently
  // become defaults when a JavaScript caller supplies property descriptors.
  for(const key of Reflect.ownKeys(patch) as (keyof GeckoDirectorOptions)[])Object.assign(o,{[key]:patch[key]});
  if(!SCENES.includes(o.scene))throw new TypeError('Unknown Gecko scene');
  finite(o.population,1,3,'population',true);finite(o.tempo,.4,1.6,'tempo');finite(o.boldness,0,1,'boldness');
  for(const key of ['reverse','showRoutes','autonomy'] as const)if(typeof o[key]!=='boolean')throw new TypeError(`${key} must be boolean`);
  if(!Array.isArray(o.roles)||o.roles.length<1||o.roles.length>3||[...o.roles].some(r=>!ROLES.includes(r)))throw new TypeError('roles must contain1..3 known Gecko roles');
  return Object.freeze({...o,roles:Object.freeze([...o.roles])});
}
export function geckoSceneArc(scene:GeckoScene,scoreTick:number):GeckoSceneArc {
  if(!SCENES.includes(scene))throw new TypeError('Unknown Gecko scene');
  finite(scoreTick,0,Number.MAX_SAFE_INTEGER,'scoreTick');
  const score=SCORES[scene],total=score.reduce((sum,b)=>sum+b[1],0);
  const cycle=Math.floor(scoreTick/total);let at=scoreTick%total;
  for(let i=0;i<score.length;i++) {const beat=score[i]!;if(at<beat[1])return {scene,beat:beat[0],beatIndex:i,progress:at/beat[1],cycle,scoreTick} as GeckoSceneArc;at-=beat[1];}
  throw new RangeError('Invalid score tick');
}
interface Forced { kind:'inspect'|'moth'|'shadow'|'return'; until:number; target:Vec2; returnAt:number | null }
interface Actor {
  id:GeckoIndividualId; index:number; role:GeckoRole; scale:number; model:GeckoModel;
  motive:GeckoMotive; emotion:GeckoEmotion; tail:number; routeIndex:number; goal:Vec2|null;
  forced:Forced|null; alarmAt:number|null; cooldownUntil:number; catches:number; phase:number; strikeUntil:number;
}

/** Opt-in director; each member uses the existing real contact-gait model. */
export function createGeckoDirector(config:GeckoDirectorConfig={}):GeckoDirector {
  record(config,['seed','heading','options','animal'],'director config');
  let seed=config.seed===undefined?37:config.seed;finite(seed,0,0xffff_ffff,'seed',true);
  let heading=config.heading;if(heading!==undefined)finite(heading,-Math.PI,Math.PI,'heading');
  let options=resolveGeckoDirectorOptions(config.options);
  let animal=resolveGeckoOptions(config.animal,{...DEFAULT_GECKO_OPTIONS,creepSpeed:.15,turnRate:.95,stepTicks:15});
  let tick=0,seq=0,scoreTick=0,disposed=false,selectedId:GeckoIndividualId|null='mica';
  let pointer:Vec2|null=null,pointerUntil=0,lastAction:GeckoDirectorReceipt|null=null;
  let mothOverride:{position:Vec2;until:number;owner:GeckoIndividualId}|null=null;
  let caughtBy:GeckoIndividualId|null=null,caughtCycle=-1;
  let shadowSince=-1000,shadowPosition:Vec2={x:1.35,y:-.3},lastShadowCycle=-1;
  let actors:Actor[]=[];
  const alive=()=>{if(disposed)throw new Error('Gecko director is disposed');};
  function modelOptions(index:number):Readonly<GeckoOptions> {
    const factor=index===2?.85:1;
    return resolveGeckoOptions({creepSpeed:clamp(animal.creepSpeed*options.tempo*factor,.02,.18),turnRate:clamp(animal.turnRate*options.tempo,.15,1.2),stepTicks:Math.round(clamp(animal.stepTicks/options.tempo,12,30))},animal);
  }
  function makeActor(index:number):Actor {
    const scale=SCALES[index]!,home=HOMES[index]!,memberSeed=(seed+Math.imul(index+1,0x9e3779b9))>>>0;
    return {id:IDS[index]!,index,role:options.roles[index]??ROLES[index]!,scale,
      model:createGecko({seed:memberSeed,heading:heading??HEADINGS[index]!,options:modelOptions(index),
        habitat:{extentX:2/scale,extentY:1/scale,origin:{x:home.x/scale,y:home.y/scale}}}),
      motive:'watch',emotion:'content',tail:.04,routeIndex:0,goal:null,forced:null,alarmAt:null,cooldownUntil:0,catches:0,phase:(memberSeed%173),strikeUntil:0};
  }
  function populate():void {
    while(actors.length>options.population)actors.pop()!.model.dispose();
    while(actors.length<options.population)actors.push(makeActor(actors.length));
    for(const a of actors){a.role=options.roles[a.index]??ROLES[a.index]!;a.model.update(modelOptions(a.index));}
    if(selectedId!==null&&!actors.some(a=>a.id===selectedId))selectedId=actors[0]!.id;
    if(mothOverride&&!actors.some(a=>a.id===mothOverride!.owner))mothOverride=null;
    if(caughtBy&&!actors.some(a=>a.id===caughtBy))caughtBy=null;
  }
  populate();
  function mothPosition():Vec2 {
    if(mothOverride&&tick<=mothOverride.until)return copy(mothOverride.position);
    return {x:.76+.075*Math.sin(scoreTick/260),y:-.52+.045*Math.sin(scoreTick/190+.7)};
  }
  function targetOwner(point:Vec2,id?:GeckoIndividualId):Actor {
    const named=id??selectedId;
    if(named!==null&&named!==undefined)return actors.find(a=>a.id===named)!;
    return actors.reduce((best,a)=>distance(world(a.model.getSnapshot(),a.scale),point)<distance(world(best.model.getSnapshot(),best.scale),point)?a:best,actors[0]!);
  }
  function snapshot():GeckoDirectorState {
    const arc=geckoSceneArc(options.scene,scoreTick);
    const shadowAge=tick-shadowSince;
    return {version:1,seed,tick,lastSequence:seq,options:optionsCopy(options),arc,selectedId,pointer:pointer?copy(pointer):null,
      moth:{position:mothPosition(),visible:(options.scene==='lantern-hunt'||!!mothOverride)&&caughtBy===null,caughtBy},
      shadow:{active:shadowAge>=0&&shadowAge<150,progress:clamp(shadowAge/150,0,1),position:copy(shadowPosition)},
      individuals:actors.map(a=>({id:a.id,label:a.id[0]!.toUpperCase()+a.id.slice(1),role:a.role,scale:a.scale,body:a.model.getSnapshot(),
        motive:a.motive,emotion:a.emotion,tailExpression:a.tail,blink:(tick+a.phase)%270<7,route:ROUTES[a.index]!.map(copy),routeIndex:a.routeIndex,
        goal:a.goal?copy(a.goal):null,cooldown:Math.max(0,a.cooldownUntil-tick),catches:a.catches})),lastAction:lastAction?{...lastAction}:null};
  }
  function validate(events:readonly GeckoDirectorEvent[]):void {
    if(!Array.isArray(events)||events.length>32)throw new RangeError('Director accepts at most32 events per tick');
    let previous=seq;
    for(const e of events) {
      if(!e||typeof e!=='object')throw new TypeError('Director event must be an object');
      if(!['guide','leave','select','moth','shadow','return','inspect'].includes(e.type))throw new TypeError('Unknown director event');
      const keys=e.type==='leave'?['type','tick','seq']:e.type==='select'?['type','tick','seq','id']:['type','tick','seq','id','x','y'];
      record(e,keys,'director event');finite(e.tick,tick+1,tick+1,'event.tick',true);finite(e.seq,previous+1,Number.MAX_SAFE_INTEGER,'event.seq',true);previous=e.seq;
      if('id'in e&&!(e.type==='select'&&e.id===null)&&(!IDS.includes(e.id!)||!actors.some(a=>a.id===e.id)))throw new RangeError('Target gecko is not in the cast');
      if(e.type==='select'&&e.id!==null&&!actors.some(a=>a.id===e.id))throw new RangeError('Select an active gecko');
      if(e.type!=='leave'&&e.type!=='select') {
        if(e.type==='guide'||'x'in e||'y'in e){finite(e.x,-1,1,'event.x');finite(e.y,-1,1,'event.y');}
      }
    }
  }
  function alarm(actor:Actor,point:Vec2,delay=0):boolean {
    const body=actor.model.getSnapshot();
    if(actor.cooldownUntil>tick||!['idle','approach'].includes(body.behavior.kind))return false;
    actor.alarmAt=tick+delay;
    actor.cooldownUntil=tick+delay+animal.startleTicks+animal.retreatTicks+animal.recoveryTicks+animal.cooldownTicks;
    actor.forced={kind:'shadow',until:tick+1200,target:copy(HOMES[actor.index]!),returnAt:null};
    return true;
  }
  function step(events:readonly GeckoDirectorEvent[]=[]):GeckoDirectorStepResult {
    alive();if(tick>=2_147_483_646)throw new RangeError('Reset before the maximum director tick');validate(events);
    tick++;const receipts:GeckoDirectorReceipt[]=[];
    for(const e of events) {
      seq=e.seq;
      if(e.type==='select'){selectedId=e.id;receipts.push({seq,type:e.type,outcome:'applied',id:selectedId});continue;}
      if(e.type==='leave'){pointer=null;for(const a of actors)if(a.forced?.kind==='inspect')a.forced=null;receipts.push({seq,type:e.type,outcome:'applied',id:null});continue;}
      const point='x'in e&&e.x!==undefined?bound({x:e.x*3.3,y:e.y!*2.2}):null;
      const actor=targetOwner(point??{x:0,y:0},e.id),position=world(actor.model.getSnapshot(),actor.scale);
      const direction=actor.model.getSnapshot().heading;
      const target=point??(e.type==='moth'?bound({x:position.x+.5,y:position.y-.2}):e.type==='inspect'
        ?bound({x:position.x+Math.cos(direction)*.65,y:position.y+Math.sin(direction)*.65}):position);
      if(e.type==='guide'||e.type==='inspect') {
        pointer=copy(target);pointerUntil=tick+Math.round(180+options.boldness*180);
        actor.forced={kind:'inspect',until:pointerUntil,target:copy(target),returnAt:null};
      } else if(e.type==='moth') {
        mothOverride={position:bound(target),until:tick+480,owner:actor.id};caughtBy=null;
        actor.forced={kind:'moth',until:tick+600,target:bound(target),returnAt:null};
      } else if(e.type==='return')actor.forced={kind:'return',until:tick+1200,target:copy(HOMES[actor.index]!),returnAt:null};
      else if(e.type==='shadow') {
        if(!alarm(actor,target)){receipts.push({seq,type:'shadow',outcome:'ignored',reason:'busy',id:actor.id});continue;}
        shadowSince=tick;shadowPosition=copy(target);
        const radius=1.2-options.boldness*.35;
        for(const other of actors)if(other!==actor&&distance(world(other.model.getSnapshot(),other.scale),target)<radius)alarm(other,target,12+other.index*8);
      }
      receipts.push({seq,type:e.type,outcome:'applied',id:actor.id});
    }
    if(receipts.length)lastAction={...receipts[receipts.length-1]!};
    const beforeArc=geckoSceneArc(options.scene,scoreTick);
    if(options.autonomy)scoreTick+=options.tempo;
    const arc=geckoSceneArc(options.scene,scoreTick);
    if(arc.cycle!==beforeArc.cycle){caughtBy=null;caughtCycle=-1;}
    if(pointer&&tick>pointerUntil)pointer=null;
    if(mothOverride&&tick>mothOverride.until){
      const owner=actors.find(a=>a.id===mothOverride!.owner);
      if(owner?.forced?.kind==='moth')owner.forced={kind:'return',until:tick+900,target:copy(HOMES[owner.index]!),returnAt:null};
      mothOverride=null;caughtBy=null;
    }
    if(options.autonomy&&arc.scene==='passing-shadow'&&arc.beat==='shadow'&&arc.cycle!==lastShadowCycle) {
      lastShadowCycle=arc.cycle;shadowSince=tick;shadowPosition={x:1.45,y:-.25};
      for(const a of actors)if(distance(world(a.model.getSnapshot(),a.scale),shadowPosition)<1.4-options.boldness*.3)alarm(a,shadowPosition,a.index*9);
    }
    const moth=mothPosition(),hunter=actors.find(a=>a.role==='hunter')??actors[0]!;
    const positions=actors.map(a=>world(a.model.getSnapshot(),a.scale));
    for(const a of actors) {
      const body=a.model.getSnapshot(),position=positions[a.index]!;
      if(a.forced&&tick>a.forced.until)a.forced=null;
      let goal:Vec2|null=null,motive:GeckoMotive='watch',emotion:GeckoEmotion='content';
      const route=ROUTES[a.index]!,direction=options.reverse?-1:1;
      if(options.autonomy) {
        // The inspect beat keeps the previous climb destination, allowing actual
        // arrival before investigation instead of changing goal at the threshold.
        const routeBeat=arc.scene==='moonlit-wall'&&arc.beat==='inspect'?arc.beatIndex-1:arc.beatIndex;
        const index=((arc.cycle+routeBeat+(a.role==='sentry'?0:a.index))*direction%route.length+route.length)%route.length;
        a.routeIndex=index;goal=copy(route[index]!);motive='explore';emotion='curious';
        const period=a.role==='sentry'?300:a.role==='hunter'?210:180,hold=a.role==='sentry'?115:a.role==='hunter'?52:30;
        if((tick+a.phase)%period<hold){goal=null;motive='watch';emotion='content';}
        if((arc.scene==='moonlit-wall'&&arc.beat==='perch')||(arc.scene==='passing-shadow'&&arc.beat==='settle')) {
          goal=copy(HOMES[a.index]!);motive=distance(position,goal)<.10?'watch':'return';
        } else if(arc.scene==='moonlit-wall'&&arc.beat==='inspect') {
          goal=copy(route[index]!);motive=distance(position,goal)<.12?'inspect':'explore';
        } else if(arc.scene==='passing-shadow'&&(arc.beat==='shelter'||arc.beat==='return')) {
          goal=copy(HOMES[a.index]!);motive=distance(position,goal)<.10?'watch':arc.beat==='shelter'?'shelter':'return';emotion='wary';
        }
      }
      const hunting=(a.forced?.kind==='moth')||(!a.forced&&options.autonomy&&!mothOverride&&arc.scene==='lantern-hunt'&&a===hunter&&arc.beat!=='return');
      if(hunting&&caughtBy===null) {
        const toward=Math.atan2(moth.y-position.y,moth.x-position.x);
        const head={x:position.x+Math.cos(body.heading)*.49*a.scale,y:position.y+Math.sin(body.heading)*.49*a.scale};
        const near=distance(head,moth)<.18,aligned=Math.cos(toward-body.heading)>.7;
        // Aim at the cue itself while creeping. An offset goal just behind a moving
        // moth can cross behind the root and turn the animal away at the last step.
        // Once the real head is close and facing it, keep all contacts still.
        goal=near&&aligned?null:copy(moth);
        motive=near&&aligned?'poise':'stalk';emotion='focused';
        const strikeWindow=(arc.scene==='lantern-hunt'&&arc.beat==='strike')||!!a.forced&&((tick+a.phase)%150>115);
        if(near&&aligned&&strikeWindow) {
          motive='strike';goal=null;
          if(caughtCycle!==arc.cycle||mothOverride){caughtBy=a.id;caughtCycle=arc.cycle;a.catches++;a.strikeUntil=tick+24;a.forced={kind:'return',until:tick+900,target:copy(HOMES[a.index]!),returnAt:null};}
        }
      }
      if(a.forced&&a.forced.kind!=='moth') {
        goal=copy(a.forced.target);emotion=a.forced.kind==='shadow'?'wary':'curious';
        motive=a.forced.kind==='inspect'?'inspect':a.forced.kind==='shadow'?'shelter':'return';
        if(distance(position,goal)<.10) {
          goal=null;
          if(a.forced.kind!=='inspect') {
            motive='watch';a.forced.returnAt??=tick;
            if(tick-a.forced.returnAt>90&&a.cooldownUntil<=tick)a.forced=null;
          }
        }
      }
      if(body.behavior.kind==='startle'||body.behavior.kind==='retreat'){motive='retreat';emotion='wary';}
      if(tick<a.strikeUntil){motive='strike';emotion='focused';goal=null;}
      // A nearby neighbor is a real obstacle: wait or take a perpendicular step.
      if(goal&&motive!=='retreat')for(const other of actors) {
        if(other===a)continue;const there=positions[other.index]!,delta={x:there.x-position.x,y:there.y-position.y};
        const desired={x:goal.x-position.x,y:goal.y-position.y};
        if(Math.hypot(delta.x,delta.y)<.78&&delta.x*desired.x+delta.y*desired.y>0) {
          const side=a.index<other.index?-1:1;goal=bound({x:position.x-delta.y*side*.65,y:position.y+delta.x*side*.65});motive='yield';break;
        }
      }
      const input:GeckoEvent[]=[];let actorSeq=body.lastSequence;
      if(goal)input.push({type:'guide',tick:body.tick+1,seq:++actorSeq,x:clamp(goal.x/2,-1,1),y:clamp(goal.y,-1,1)});
      else if(body.target)input.push({type:'leave',tick:body.tick+1,seq:++actorSeq});
      if(a.alarmAt!==null&&tick>=a.alarmAt){input.push({type:'startle',tick:body.tick+1,seq:++actorSeq});a.alarmAt=null;}
      a.model.step(input);a.goal=goal;a.motive=motive;a.emotion=emotion;
      const tail=emotion==='wary'?.62:emotion==='focused'?.10:emotion==='curious'?.26:.04;
      a.tail+=(tail-a.tail)*.055;
    }
    return {state:snapshot(),inputs:receipts.map(r=>({...r}))};
  }
  return {
    get disposed(){return disposed;},step,getSnapshot(){alive();return snapshot();},
    update(patch) {
      alive();const next=resolveGeckoDirectorOptions(patch,options),changedScene=next.scene!==options.scene;
      options=next;populate();
      if(changedScene){scoreTick=0;lastShadowCycle=-1;caughtCycle=-1;caughtBy=null;mothOverride=null;pointer=null;shadowSince=-1000;for(const a of actors){a.forced=null;a.alarmAt=null;a.strikeUntil=0;}}
      return optionsCopy(options);
    },
    updateAnimal(patch){alive();const next=resolveGeckoOptions(patch,animal);animal=next;for(const a of actors)a.model.update(modelOptions(a.index));return {...animal};},
    select(id){alive();if(id!==null&&!actors.some(a=>a.id===id))throw new RangeError('Select an active gecko');selectedId=id;},
    reset(reset={}) {
      alive();record(reset,['seed','heading'],'director reset');
      const nextSeed=reset.seed===undefined?seed:reset.seed,nextHeading=reset.heading===undefined?heading:reset.heading;
      finite(nextSeed,0,0xffff_ffff,'seed',true);if(nextHeading!==undefined)finite(nextHeading,-Math.PI,Math.PI,'heading');
      seed=nextSeed;heading=nextHeading;for(const a of actors)a.model.dispose();actors=[];
      tick=0;seq=0;scoreTick=0;pointer=null;pointerUntil=0;lastAction=null;mothOverride=null;caughtBy=null;caughtCycle=-1;shadowSince=-1000;shadowPosition={x:1.35,y:-.3};lastShadowCycle=-1;
      selectedId='mica';populate();return snapshot();
    },
    exportRecipe(){alive();return {version:1,kind:'gecko-scene-recipe',seed,...(heading===undefined?{}:{heading}),options:optionsCopy(options),animal:{...animal},startsAtTick:0};},
    dispose(){if(disposed)return;disposed=true;for(const a of actors)a.model.dispose();actors=[];pointer=null;mothOverride=null;},
  };
}

/** Presentation-only deliberate pose. Does not step or mutate a director/model. */
export function geckoDirectorPoster(state:GeckoDirectorState,cue:GeckoDirectorCue):GeckoDirectorState {
  const id=cue.id??state.selectedId??state.individuals[0]!.id;
  const individual=state.individuals.find(a=>a.id===id)??state.individuals[0]!;
  const position=world(individual.body,individual.scale);
  const target=cue.x===undefined?{x:position.x+.55,y:position.y-.15}:bound({x:cue.x*3.3,y:cue.y!*2.2});
  return {...state,pointer:cue.type==='inspect'?target:state.pointer,
    moth:cue.type==='moth'?{position:target,visible:true,caughtBy:null}:state.moth,
    shadow:cue.type==='shadow'?{active:true,progress:.5,position:copy(position)}:state.shadow,
    individuals:state.individuals.map(a=>a.id===id?{...a,motive:cue.type==='shadow'?'shelter':cue.type==='moth'?'poise':cue.type==='return'?'watch':'inspect',
      emotion:cue.type==='shadow'?'wary':cue.type==='moth'?'focused':cue.type==='return'?'content':'curious',
      tailExpression:cue.type==='shadow'?.9:cue.type==='return'?.04:.3,body:{...a.body,tailCurl:cue.type==='shadow'?.9:a.body.tailCurl}}:a)};
}
