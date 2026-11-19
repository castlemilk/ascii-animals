/** Species-owned pond choreography; existing dragonfly-v1 and its replay stay unchanged. */
import { createDragonfly, finiteNumber, validateDragonflyOptions } from './model.js';
import { buildDragonflyGeometry } from './geometry.js';
import type { Dragonfly, DragonflyConfigPatch, DragonflyGeometry, DragonflyOptions, DragonflyState, Vec2, Vec3 } from './types.js';

export type DragonflyScene = 'patrol' | 'attention' | 'relay';
export type DragonflyRoute = 'banks' | 'figure-eight' | 'orbit';
export type DragonflyRole = 'patroller' | 'sentinel' | 'skimmer' | 'wanderer';
export type DragonflyCue = 'dart' | 'perch' | 'return';
export interface DragonflyDirectorOptions {
  readonly scene: DragonflyScene; readonly count: number; readonly route: DragonflyRoute;
  readonly tempo: number; readonly spread: number; readonly scale: number; readonly breeze: number;
  readonly labels: boolean; readonly roles: readonly [DragonflyRole, DragonflyRole, DragonflyRole, DragonflyRole];
}
export type DragonflyDirectorInput = { readonly tick: number; readonly seq: number } & (
  | { readonly type: 'pointer'; readonly x: number; readonly y: number }
  | { readonly type: 'leave' }
  | { readonly type: 'select'; readonly id: number }
  | { readonly type: 'cue'; readonly cue: DragonflyCue }
);
export type DragonflyDirectorPhase = {
  readonly kind: 'patrol' | 'attention' | 'hover' | 'launch' | 'dart' | 'settle' | 'return' | 'land' | 'perched' | 'cooldown';
  readonly elapsed: number; readonly duration: number;
};
export interface DragonflyDirectorMember {
  readonly id: number; readonly label: string; readonly seed: number; readonly role: DragonflyRole;
  readonly position: Vec3; readonly perch: Vec3; readonly velocity: Vec2; readonly heading: number;
  readonly phase: DragonflyDirectorPhase; readonly modelTick: number;
}
export interface DragonflyDirectorState {
  readonly tick: number; readonly lastSeq: number; readonly scene: DragonflyScene;
  readonly arc: 'arrive' | 'patrol' | 'intercept' | 'return' | 'rest';
  readonly selected: number; readonly target: Vec2 | null; readonly members: readonly DragonflyDirectorMember[];
}
export interface DragonflyDirectedGeometry {
  readonly id: number; readonly label: string; readonly role: DragonflyRole;
  readonly selected: boolean; readonly phase: DragonflyDirectorPhase;
  readonly position: Vec3; readonly perch: Vec3; readonly geometry: DragonflyGeometry;
}
export interface DragonflyDirectorStepResult {
  readonly kind: 'advanced' | 'resting'; readonly state: DragonflyDirectorState;
  readonly acceptedCue: boolean; readonly ignoredCues: number;
}
export interface DragonflyDirector {
  getState(): DragonflyDirectorState;
  getOptions(): Readonly<DragonflyDirectorOptions>;
  getPrimaryState(): DragonflyState;
  getModelOptions(): Readonly<DragonflyOptions>;
  step(tick: number, events?: readonly DragonflyDirectorInput[]): DragonflyDirectorStepResult;
  configure(patch: Partial<DragonflyDirectorOptions>): Readonly<DragonflyDirectorOptions>;
  configureModel(patch: DragonflyConfigPatch): Readonly<DragonflyOptions>;
  setPaused(paused: boolean): void;
  selectIndividual(id: number): void;
  setStaticPose(pose: 0 | 1): void;
  clearTarget(): void;
  reset(seed?: number): void;
  sample(): readonly DragonflyDirectedGeometry[];
  dispose(): void;
}

const ROLES: readonly DragonflyRole[] = ['patroller', 'sentinel', 'skimmer', 'wanderer'];
export const DRAGONFLY_DIRECTOR_DEFAULTS: Readonly<DragonflyDirectorOptions> = Object.freeze({
  scene: 'patrol', count: 3, route: 'banks', tempo: 1, spread: 1, scale: .4, breeze: .12,
  labels: true, roles: Object.freeze(['patroller', 'sentinel', 'skimmer', 'wanderer'] as const),
});
export const DRAGONFLY_DIRECTOR_LIMITS = Object.freeze({ members: 4, samples: 24576, eventsPerTick: 16,
  maxTick: 2147483647, rootX: 1.3, rootYMin: -.65, rootYMax: 1.05, speed: .9, dartSpeed: 2.6,
  acceleration: 3.2, dartAcceleration: 9, tickRate: 60 });
const TAU = Math.PI * 2, DT = 1 / 60;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const v2 = (x: number, y: number): Vec2 => Object.freeze({ x, y });
const v3 = (x: number, y: number, z = .12): Vec3 => Object.freeze({ x, y, z });
const mix = (a: Vec3, b: Vec3, u: number): Vec3 => v3(a.x + (b.x-a.x)*u, a.y + (b.y-a.y)*u, a.z + (b.z-a.z)*u);
const ease = (u: number): number => { u = clamp(u, 0, 1); return u*u*(3-2*u); };
const phase = (kind: DragonflyDirectorPhase['kind'], elapsed = 0, duration = 0): DragonflyDirectorPhase => Object.freeze({ kind, elapsed, duration });
const names = ['Azure', 'Reed', 'Ember', 'Moss'];
const seedFor = (seed: number, id: number): number => (seed + Math.imul(id, 104729)) >>> 0;
const bounded = (p: Vec3): Vec3 => v3(clamp(p.x, -1.3, 1.3), clamp(p.y, -.65, 1.05), clamp(p.z, .04, .32));
function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`Unknown director field: ${key}`);
}
function optionsWith(patch: Partial<DragonflyDirectorOptions>, base: Readonly<DragonflyDirectorOptions>): Readonly<DragonflyDirectorOptions> {
  keys(record(patch, 'director options'), Object.keys(DRAGONFLY_DIRECTOR_DEFAULTS));
  const next = { ...base, ...patch };
  if (!['patrol', 'attention', 'relay'].includes(next.scene)) throw new TypeError('Unknown director scene');
  if (!['banks', 'figure-eight', 'orbit'].includes(next.route)) throw new TypeError('Unknown director route');
  finiteNumber(next.count, 'count', 1, 4, true); finiteNumber(next.tempo, 'tempo', .4, 1.6);
  finiteNumber(next.spread, 'spread', .65, 1.1); finiteNumber(next.scale, 'scale', .28, .48);
  finiteNumber(next.breeze, 'breeze', -.5, .5);
  if (typeof next.labels !== 'boolean') throw new TypeError('labels must be boolean');
  if (!Array.isArray(next.roles) || next.roles.length !== 4 || Array.from(next.roles).some(role => !ROLES.includes(role)))
    throw new TypeError('roles must contain exactly four declared roles');
  return Object.freeze({ ...next, roles: Object.freeze([...next.roles]) as DragonflyDirectorOptions['roles'] });
}
export function validateDragonflyDirectorOptions(input: Partial<DragonflyDirectorOptions> = {}): Readonly<DragonflyDirectorOptions> {
  return optionsWith(input, DRAGONFLY_DIRECTOR_DEFAULTS);
}

interface Response { cue: DragonflyCue; elapsed: number; from: Vec3; ready: Vec3; to: Vec3;
  home: Vec3; wasPerched: boolean; heading: number; launchTicks: number }
interface PresentationPose {
  position: Vec3; heading: number; wingPhase: number; strength: number; pitch: number; grip: number;
}
interface Member extends PresentationPose {
  id: number; model: Dragonfly; position: Vec3; velocity: Vec2; heading: number; phase: DragonflyDirectorPhase;
  response: Response | null; held: boolean; previous: PresentationPose;
}
const poseOf = (m: PresentationPose): PresentationPose => ({ position:m.position, heading:m.heading,
  wingPhase:m.wingPhase, strength:m.strength, pitch:m.pitch, grip:m.grip });
const angleMix = (a:number,b:number,u:number):number => a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;

/** One explicit scene clock; no DOM, scheduler, randomness, renderer or wall-clock reads. */
export function createDragonflyDirector(input: Partial<DragonflyDirectorOptions> = {}, modelInput: Partial<DragonflyOptions> = {}): DragonflyDirector {
  return createDragonflyDirectorHost(input, modelInput).director;
}

/** Species-internal presentation seam. The accepted public director is unchanged.
 * Interpolation regenerates articulated geometry, never stretches sampled wings. */
export function createDragonflyDirectorHost(input: Partial<DragonflyDirectorOptions> = {}, modelInput: Partial<DragonflyOptions> = {}):
  { readonly director: DragonflyDirector; readonly samplePresentation: (alpha: number) => readonly DragonflyDirectedGeometry[] } {
  let options = validateDragonflyDirectorOptions(input);
  const checkedModel = validateDragonflyOptions(modelInput);
  let seed = checkedModel.seed, tick = 0, lastSeq = -1, clock = 0, selected = 0;
  let target: Vec2 | null = null, paused = false, disposed = false;
  const members: Member[] = [];
  const alive = (): void => { if (disposed) throw new Error('Dragonfly director is disposed'); };
  const validId = (id: number): void => { finiteNumber(id, 'individual id', 0, members.length - 1, true); };
  const home = (id: number): Vec3 => {
    // Stagger the actual reeds, including the explicit still arrangement. A
    // single lower row merged three neutral visitors into two silhouettes.
    const x = [-1.02, .96, -.78, .83][id]! * options.spread;
    return v3(x, [-.25, -.25, 1.02, 1.02][id]!, .06);
  };
  // Arrival and the alternate still pose share the same four disjoint
  // territories as the reeds. The old third arrival sat over visitor 02,
  // merging their wings in reduced-motion portrait previews.
  const initial = (id: number): Vec3 => {
    const anchor = home(id);
    return id === 0 ? v3(-.88 * options.spread, -.38, .17)
      : id === 1 ? anchor : v3(anchor.x, anchor.y + .15, .17);
  };
  function add(id: number, config: Readonly<DragonflyOptions>): void {
    const model = createDragonfly({ ...config, seed: seedFor(seed, id) }); model.setPaused(paused);
    const pose:PresentationPose={position:initial(id),heading:id===1?-.18:.12,
      wingPhase:model.getState().wingPhase,strength:id===1?0:1,pitch:0,grip:id===1?1:0};
    members.push({id,model,...pose,previous:poseOf(pose),velocity:v2(0,0),
      phase:phase(id===1?'perched':'hover'),response:null,held:false});
  }
  for (let id=0; id<options.count; id++) add(id, checkedModel);

  function route(member: Member): Vec3 {
    const id = member.id, role = options.roles[id]!;
    const t = clock/60, offset = id*1.71 + (seedFor(seed,id)%997)/997;
    const speed = role === 'skimmer' ? .72 : role === 'wanderer' ? .36 : .48;
    const a = t*speed + offset;
    // Assigned territories keep paired wings legible. The first broad shared
    // sinusoid put all three visitors on the right bank at tick 360.
    const cx = [-.85,.86,-.78,.83][id]!, cy = [-.47,-.35,.61,.72][id]!;
    let x: number, y: number;
    if (options.route === 'figure-eight') { x = cx + Math.sin(a)*.27; y = cy + Math.sin(a*2)*.17; }
    else if (options.route === 'orbit') { x = cx + Math.cos(a)*.26; y = cy + Math.sin(a)*.19; }
    else { x = cx + Math.sin(a)*.29; y = cy + Math.sin(a + id)*.10; }
    if (role === 'sentinel') { x = cx + Math.sin(a)*.12; y = cy + Math.sin(a*.6)*.09; }
    if (role === 'wanderer') y += Math.sin(a*.7)*.06;
    x += Math.sin(t*.28 + id)*options.breeze*.2;
    return bounded(v3(x*options.spread, y, .16 + .035*Math.sin(a)));
  }
  function autonomous(member: Member): { goal: Vec3; phase: DragonflyDirectorPhase } {
    const id = member.id, role = options.roles[id]!, reed = home(id), path = route(member);
    if (member.held) return { goal: reed, phase: phase('perched') };
    if (target && selected === id && member.model.getOptions().followPointer) {
      const a = clock/90 + id;
      return { goal: bounded(v3(target.x*1.12 + Math.cos(a)*.035, .2+target.y*.68+Math.sin(a)*.035, .26)), phase: phase('attention') };
    }
    if (options.scene === 'attention' && selected === id) {
      const a=clock/100;
      return {goal: v3(Math.sin(a)*.24, -.12+Math.cos(a*.8)*.10,.28), phase:phase('attention')};
    }
    if (options.scene === 'attention') {
      const a=clock/95+id;
      return role==='sentinel' ? {goal:reed,phase:phase('perched')} :
        {goal:bounded(v3(reed.x+Math.sin(a)*.12,reed.y-.10+Math.sin(a*.7)*.08,.12)),phase:phase('hover')};
    }
    const period = options.scene === 'relay' ? 720 : role === 'sentinel' ? 840 : 1080;
    const local = (clock + id*(options.scene === 'relay' ? 180 : 217)) % period;
    const resting = options.scene === 'relay' ? 150 : role === 'sentinel' ? 300 : 130;
    if (local < resting) return { goal: reed, phase: phase('perched', local, resting) };
    if (local < resting+70) return { goal: mix(reed, path, ease((local-resting-18)/52)), phase:phase('launch',local-resting,70) };
    if (local > period-130) return { goal: reed, phase: phase(local>period-55?'land':'return',local-(period-130),130) };
    if (options.scene === 'relay' && local < resting+170) {
      return {goal:bounded(v3(-reed.x, -.35+id*.18,.24)),phase:phase('dart',local-resting-70,100)};
    }
    // Distinct lookout pauses interrupt route following; the path itself remains periodic.
    if (role !== 'skimmer' && local > period*.55 && local < period*.55+90)
      return {goal:v3((id%2 ? .72 : -.72)*options.spread,-.28+id*.12,.2),phase:phase('hover',local-period*.55,90)};
    return { goal: path, phase: phase('patrol',local,period) };
  }
  function startCue(member: Member, cue: DragonflyCue): boolean {
    if (member.response && cue !== 'return') return false;
    const reed = home(member.id), wasPerched=member.held || member.phase.kind==='perched';
    member.held = false;
    // Local head is -Y: retreat along +Y, keeping the animal facing its lookout.
    // Near the lower bank, use the anticipation to make room before backing up.
    const rear=v2(-Math.sin(member.heading),Math.cos(member.heading));
    const room=Math.min(rear.x>1e-6?(1.25-member.position.x)/rear.x:rear.x< -1e-6?(-1.25-member.position.x)/rear.x:Infinity,
      rear.y>1e-6?(1.0-member.position.y)/rear.y:rear.y< -1e-6?(-.6-member.position.y)/rear.y:Infinity);
    const preparation=clamp(.64-room,.04,.55);
    const ready=bounded(v3(member.position.x-rear.x*preparation,member.position.y-rear.y*preparation,.24));
    let aim=bounded(v3(ready.x+rear.x*.64,ready.y+rear.y*.64,.25));
    // Pick a tailward lane with room for the four wing lobes. This is a bounded
    // choice made once per cue, not a per-frame avoidance force that adds jitter.
    if(cue==='dart'&&members.length>1) {
      const side=v2(Math.cos(member.heading),Math.sin(member.heading));
      let best=Infinity;
      for(const offset of [0,.32,-.32,.64,-.64]) {
        const candidate=bounded(v3(ready.x+rear.x*.64+side.x*offset,ready.y+rear.y*.64+side.y*offset,.25));
        let cost=Math.abs(offset)*.035;
        for(const other of members)if(other.id!==member.id) {
          const x=other.position.x+other.velocity.x*.6,y=other.position.y+other.velocity.y*.6;
          const separation=((candidate.x-x)/(options.scale*3.1))**2+((candidate.y-y)/(options.scale*1.55))**2;
          cost+=Math.max(0,1-separation)**2;
        }
        if(cost<best){best=cost;aim=candidate;}
      }
    }
    member.response = {cue,elapsed:0,from:member.position,ready,
      to:cue==='perch'?reed:cue==='return'?route(member):aim,
      home:wasPerched?reed:member.position,wasPerched,heading:member.heading,
      launchTicks:Math.max(24,Math.round(18+preparation*100))};
    return true;
  }
  function responseGoal(member: Member, advance: number): { goal: Vec3; phase: DragonflyDirectorPhase } {
    const r=member.response!; r.elapsed+=advance;
    const e=r.elapsed;
    if(r.cue==='perch') {
      if(e<100) return {goal:mix(r.from,r.to,ease(e/100)),phase:phase('return',e,100)};
      if(e<160) return {goal:r.to,phase:phase('land',e-100,60)};
      member.response=null;member.held=true;return {goal:r.to,phase:phase('perched')};
    }
    if(r.cue==='return') {
      // A held twig releases in an authored order: wings, feet, lift, cruise.
      const lift=r.wasPerched?42:0;
      if(e<lift) return {goal:mix(r.from,r.ready,ease((e-18)/24)),phase:phase('launch',e,lift)};
      if(e<lift+100) return {goal:mix(r.wasPerched?r.ready:r.from,r.to,ease((e-lift)/100)),phase:phase('return',e-lift,100)};
      if(e<lift+145) return {goal:r.to,phase:phase('settle',e-lift-100,45)};
      member.response=null;return autonomous(member);
    }
    const ready=r.launchTicks,brake=ready+30,recover=brake+54,home=recover+90,done=home+60;
    if(e<ready) return {goal:mix(r.from,r.ready,ease(e/ready)),phase:phase('launch',e,ready)};
    if(e<brake) return {goal:r.to,phase:phase('dart',e-ready,30)};
    if(e<recover) return {goal:r.to,phase:phase('settle',e-brake,54)};
    if(e<home) return {goal:mix(r.to,r.home,ease((e-recover)/90)),phase:phase('return',e-recover,90)};
    if(e<done) return {goal:r.home,phase:phase(r.wasPerched?'land':'cooldown',e-home,60)};
    member.response=null; member.held=r.wasPerched;
    return {goal:r.home,phase:phase(r.wasPerched?'perched':'hover')};
  }
  function move(member: Member, goal: Vec3, next: DragonflyDirectorPhase, pace: number): void {
    const landing = next.kind === 'perched';
    const fast=next.kind==='dart';
    const maxSpeed=(fast?2.6:.9)*pace, maxAcceleration=(fast?9:3.2)*pace;
    const dx=goal.x-member.position.x,dy=goal.y-member.position.y;
    let ax=dx*(fast?75:22)-member.velocity.x*(fast?11:8),ay=dy*(fast?75:22)-member.velocity.y*(fast?11:8);
    const length=Math.hypot(ax,ay); if(length>maxAcceleration){ax*=maxAcceleration/length;ay*=maxAcceleration/length;}
    let vx=member.velocity.x+ax*DT,vy=member.velocity.y+ay*DT;
    const speed=Math.hypot(vx,vy);if(speed>maxSpeed){vx*=maxSpeed/speed;vy*=maxSpeed/speed;}
    // A lower target cruise speed must not hard-clip a dart's incoming velocity.
    // Bound the final vector change too, allowing controlled braking in settle.
    const dvx=vx-member.velocity.x,dvy=vy-member.velocity.y,delta=Math.hypot(dvx,dvy);
    if(delta>maxAcceleration*DT){vx=member.velocity.x+dvx/delta*maxAcceleration*DT;vy=member.velocity.y+dvy/delta*maxAcceleration*DT;}
    let position=bounded(v3(member.position.x+vx*DT,member.position.y+vy*DT,member.position.z+(goal.z-member.position.z)*Math.min(1,.08*pace)));
    const distanceToGoal=Math.hypot(goal.x-position.x,goal.y-position.y);
    const touching=landing||next.kind==='land';
    const backward=member.response?.cue==='dart'&&['launch','dart','settle'].includes(next.kind);
    const desired=touching?-.18+member.id*.08:backward?member.response!.heading:clamp(vx*.75,-.55,.55);
    member.heading+=clamp(desired-member.heading,-.018*pace,.018*pace);
    const pitch=touching?0:next.kind==='dart'?-.32:backward&&next.kind==='settle'?.20:
      next.kind==='launch'?-.16:clamp(-vy*.13,-.10,.10);
    const blend=1-Math.exp(-8*DT*pace);
    member.pitch+=(pitch-member.pitch)*blend;
    const grip=touching?1-clamp(distanceToGoal/.24,0,1):0;
    member.grip+=(grip-member.grip)*blend;
    // Flight power tapers to zero at contact; declaration of 'perched' waits
    // for the whole pose to settle, avoiding a final wing/attitude snap.
    const wanted=touching?clamp(distanceToGoal/.18,0,1):next.kind==='launch'?ease(next.elapsed/18):1;
    member.strength+=(wanted-member.strength)*(1-Math.exp(-10*DT*pace));
    if(landing) {
      if(distanceToGoal<.001 && Math.hypot(vx,vy)<.008 && Math.abs(member.heading-desired)<.002 &&
        Math.abs(member.pitch)<.002 && member.strength<.002 && member.grip>.998) {
        position=goal;vx=0;vy=0;member.heading=desired;member.pitch=0;member.grip=1;member.strength=0;
      } else next=phase('land',0,60);
    }
    member.velocity=v2(vx,vy);member.position=position;member.phase=next;
    member.wingPhase=(member.wingPhase+TAU*member.model.getOptions().wingHz*DT*pace*member.strength)%TAU;
  }
  function getState(): DragonflyDirectorState {
    const phases=members.map(m=>m.phase.kind);
    const arc:DragonflyDirectorState['arc']=clock<90?'arrive':phases.includes('dart')?'intercept':phases.some(p=>p==='return'||p==='land')?'return':phases.every(p=>p==='perched')?'rest':'patrol';
    return Object.freeze({tick,lastSeq,scene:options.scene,arc,selected,target,
      members:Object.freeze(members.map(m=>Object.freeze({id:m.id,label:names[m.id]!,seed:m.model.getOptions().seed,
        role:options.roles[m.id]!,position:m.position,perch:home(m.id),velocity:m.velocity,heading:m.heading,phase:m.phase,modelTick:m.model.getState().tick}))) });
  }
  function validateEvents(events:readonly DragonflyDirectorInput[],nextTick:number):void {
    if(!Array.isArray(events)||events.length>16)throw new RangeError('At most 16 director events per tick');
    let seq=lastSeq;
    for(const event of events){
      const raw=record(event,'director event');
      if(event.tick!==nextTick)throw new RangeError('Director event tick must match next tick');
      finiteNumber(event.seq,'seq',0,Number.MAX_SAFE_INTEGER,true);if(event.seq<=seq)throw new RangeError('Director sequence must strictly increase');seq=event.seq;
      if(event.type==='pointer'){keys(raw,['type','tick','seq','x','y']);finiteNumber(event.x,'pointer.x',-1,1);finiteNumber(event.y,'pointer.y',-1,1);}
      else if(event.type==='select'){keys(raw,['type','tick','seq','id']);validId(event.id);}
      else if(event.type==='leave')keys(raw,['type','tick','seq']);
      else if(event.type==='cue'){keys(raw,['type','tick','seq','cue']);if(!['dart','perch','return'].includes(event.cue))throw new TypeError('Unknown director cue');}
      else throw new TypeError('Unknown director event');
    }
  }
  const api:DragonflyDirector={
    getState,getOptions:()=>options,getPrimaryState:()=>members[0]!.model.getState(),getModelOptions:()=>members[0]!.model.getOptions(),
    step(nextTick,events=[]){
      alive();finiteNumber(nextTick,'tick',1,DRAGONFLY_DIRECTOR_LIMITS.maxTick,true);
      if(nextTick!==tick+1)throw new RangeError('Director requires exactly the next integer tick');validateEvents(events,nextTick);
      if(paused||api.getModelOptions().motion==='static')return Object.freeze({kind:'resting',state:getState(),acceptedCue:false,ignoredCues:events.filter(e=>e.type==='cue').length});
      let acceptedCue=false,ignoredCues=0;
      for(const event of events){lastSeq=event.seq;if(event.type==='select')selected=event.id;else if(event.type==='pointer')target=v2(event.x,event.y);else if(event.type==='leave')target=null;else if(startCue(members[selected]!,event.cue))acceptedCue=true;else ignoredCues++;}
      tick=nextTick;const pace=options.tempo*(api.getModelOptions().motion==='slow'?.25:1);clock+=pace;
      for(const member of members){member.previous=poseOf(member);member.model.step(member.model.getState().tick+1);const plan=member.response?responseGoal(member,pace):autonomous(member);move(member,plan.goal,plan.phase,pace);}
      return Object.freeze({kind:'advanced',state:getState(),acceptedCue,ignoredCues});
    },
    configure(patch){
      alive();const next=optionsWith(patch,options);const config=api.getModelOptions();options=next;
      while(members.length>options.count)members.pop()!.model.dispose();while(members.length<options.count)add(members.length,config);
      selected=Math.min(selected,members.length-1);return options;
    },
    configureModel(patch){
      alive();const raw=record(patch,'model patch');if(Object.hasOwn(raw,'seed'))throw new TypeError('Use reset(seed)');
      validateDragonflyOptions({...api.getModelOptions(),...patch});
      for(const member of members)member.model.configure(patch);return api.getModelOptions();
    },
    setPaused(value){alive();if(typeof value!=='boolean')throw new TypeError('paused must be boolean');paused=value;for(const m of members)m.model.setPaused(value);},
    selectIndividual(id){alive();validId(id);selected=id;},
    setStaticPose(pose){
      alive();if(pose!==0&&pose!==1)throw new RangeError('static pose must be 0 or 1');
      for(const m of members){m.model.setStaticPose(pose);m.position=pose===0?home(m.id):initial(m.id);m.velocity=v2(0,0);m.heading=pose===0?-.18+m.id*.08:(m.id%2?.52:-.42);m.phase=phase(pose===0?'perched':'hover');m.strength=pose===0?0:1;m.wingPhase=m.model.getState().wingPhase;m.pitch=0;m.grip=pose===0?1:0;m.response=null;m.held=false;m.previous=poseOf(m);}
      target=null;
    },
    clearTarget(){alive();target=null;for(const m of members)m.model.clearTarget();},
    reset(nextSeed=seed){
      alive();finiteNumber(nextSeed,'seed',0,0xffffffff,true);seed=nextSeed;tick=0;lastSeq=-1;clock=0;target=null;selected=0;
      for(const m of members){m.model.reset(seedFor(seed,m.id));m.position=initial(m.id);m.velocity=v2(0,0);m.heading=m.id===1?-.18:.12;m.phase=phase(m.id===1?'perched':'hover');m.wingPhase=m.model.getState().wingPhase;m.strength=m.id===1?0:1;m.pitch=0;m.grip=m.id===1?1:0;m.response=null;m.held=false;m.previous=poseOf(m);}
    },
    sample(){return sampleAt(1);},
    dispose(){if(disposed)return;disposed=true;paused=true;for(const m of members)m.model.dispose();},
  };
  function sampleAt(alpha:number):readonly DragonflyDirectedGeometry[] {
      alive();finiteNumber(alpha,'presentation fraction',0,1);
      return members.map(m=>{
        const state=m.model.getState(), config=m.model.getOptions();
        const prev=m.previous,position=alpha===1?m.position:alpha===0?prev.position:mix(prev.position,m.position,alpha);
        const heading=alpha===1?m.heading:angleMix(prev.heading,m.heading,alpha);
        const wingPhase=alpha===1?m.wingPhase:angleMix(prev.wingPhase,m.wingPhase,alpha);
        const strength=prev.strength+(m.strength-prev.strength)*alpha;
        const pitch=prev.pitch+(m.pitch-prev.pitch)*alpha,grip=prev.grip+(m.grip-prev.grip)*alpha;
        const geometry=buildDragonflyGeometry({...state,position:v2(0,0),heading:0,wingPhase},
          {...config,motion:'full',wingAmplitude:config.wingAmplitude*strength},{pitch,grip});
        const scale=options.scale*(1-m.id*.035),c=Math.cos(heading),s=Math.sin(heading);
        const transform=(p:Vec3):Vec3=>v3(position.x+(c*p.x-s*p.y)*scale,position.y+(s*p.x+c*p.y)*scale,position.z+p.z*scale);
        const mapped:DragonflyGeometry={samples:geometry.samples.map(p=>({...p,...transform(p)})),
          wings:geometry.wings.map(w=>({...w,root:transform(w.root),tip:transform(w.tip)})),
          eyes:[transform(geometry.eyes[0]),transform(geometry.eyes[1])],abdomenTip:transform(geometry.abdomenTip)};
        return {id:m.id,label:names[m.id]!,role:options.roles[m.id]!,phase:m.phase,selected:m.id===selected,position,perch:home(m.id),geometry:mapped};
      });
  }
  return Object.freeze({director:Object.freeze(api),samplePresentation:sampleAt});
}
