import type { FoxBehavior, FoxCreateOptions, FoxFoot, FoxInput, FoxModel, FoxOptions,
  FoxOptionsInput, FoxPoint, FoxPose, FoxSpecies, FoxState, FoxStaticPose, FoxStepResult } from './types.js';
import { FOX_DEFAULTS, FOX_LIMITS, clamp, finite, integer, plain, resolveFoxOptions, smooth } from './config.js';
import { poseFox, neutralFeet } from './geometry.js';
export { FOX_DEFAULTS, FOX_LIMITS, resolveFoxOptions } from './config.js';
export type * from './types.js';

const TAU = Math.PI * 2;
const reaction = (b: FoxBehavior): b is Extract<FoxBehavior, {plan: unknown}> => 'plan' in b;

function seedPhase(seed: number): number {
  let n = Math.imul(seed ^ 0x51ed270b, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000 * TAU;
}

/** Freeze owned nested objects, so caller writes cannot corrupt later simulation. */
function seal(state: FoxState): FoxState {
  Object.freeze(state.target);
  for (const foot of state.feet) Object.freeze(foot);
  Object.freeze(state.feet);
  if (reaction(state.behavior)) Object.freeze(state.behavior.plan);
  Object.freeze(state.behavior);
  return Object.freeze(state);
}

function initial(seed: number, options: FoxOptions): FoxState {
  const phase = seedPhase(seed);
  return seal({schemaVersion:1,speciesVersion:1,species:'fox',tick:0,lastSequence:-1,seed,
    rootX:0,velocityX:0,gait:0,breathPhase:phase,tailPhase:(phase+1.7)%TAU,
    target:{active:false,x:0,y:0},feet:neutralFeet(0,options),behavior:{kind:'idle'}});
}

function validateInputs(state: FoxState, tick: number, inputs: readonly FoxInput[]): {
  target: FoxState['target']; sequence: number; wantsPounce: boolean;
} {
  integer(tick, 1, FOX_LIMITS.maxTick, 'tick');
  if (tick !== state.tick + 1) throw new RangeError('step requires exactly the next integer tick');
  if (!Array.isArray(inputs) || inputs.length > FOX_LIMITS.eventsPerTick) throw new RangeError('At most 16 inputs per tick');
  let target = state.target, sequence = state.lastSequence, wantsPounce = false;
  for (const event of inputs) {
    plain(event, 'input');
    const allowed = event.type === 'guide' ? ['type','tick','seq','x','y'] : ['type','tick','seq'];
    for (const key of Object.keys(event)) if (!allowed.includes(key)) throw new TypeError(`Unknown input field: ${key}`);
    if (event.tick !== tick) throw new RangeError('Input must have the next tick');
    const seq = integer(event.seq, 0, Number.MAX_SAFE_INTEGER, 'input seq');
    if (seq <= sequence) throw new RangeError('Input seq must be strictly increasing');
    sequence = seq;
    switch (event.type) {
      case 'guide': target = {active:true,x:clamp(finite(event.x,'guide x'),-1,1),y:clamp(finite(event.y,'guide y'),-1,1)}; break;
      case 'leave': target = {active:false,x:0,y:0}; break;
      case 'pounce': wantsPounce = true; break;
      default: throw new TypeError('Unknown input type');
    }
  }
  return {target, sequence, wantsPounce};
}

function nextBehavior(b: FoxBehavior): FoxBehavior {
  if (!reaction(b)) return b;
  const o = b.plan.options;
  switch (b.kind) {
    case 'crouch': return b.age+1 >= o.crouchTicks ? {kind:'airborne',age:0,plan:b.plan} : {...b,age:b.age+1};
    case 'airborne': return b.age+1 >= o.airTicks ? {kind:'landing',age:0,plan:b.plan} : {...b,age:b.age+1};
    case 'landing': return b.age+1 >= o.landingTicks ? {kind:'recover',age:0,plan:b.plan} : {...b,age:b.age+1};
    case 'recover': return b.age+1 >= o.recoveryTicks ? {kind:'cooldown',remaining:o.cooldownTicks,plan:b.plan} : {...b,age:b.age+1};
    case 'cooldown': return b.remaining <= 1 ? {kind:'idle'} : {...b,remaining:b.remaining-1};
  }
}

/** Each stance paw has a stored WORLD x. It stays fixed until its own swing. */
function walkFeet(state: FoxState, rootX: number, dx: number, gait: number, options: FoxOptions): readonly FoxFoot[] {
  const rests = neutralFeet(rootX, options);
  const offsets = [0,.5,.75,.25];
  return state.feet.map((foot, i) => {
    const rest = rests[i]!;
    const p = (gait + offsets[i]!) % 1;
    const moving = Math.abs(dx) > .000015;
    let f = foot;
    if (f.mode === 'planted' && moving && p < .22 && Math.abs(f.x-rest.x) > .012) {
      f = {...f,mode:'swing',progress:0,fromX:f.x,toX:rest.x+Math.sign(dx)*.035};
    }
    // Finish a started swing even when guidance stops. No paw freezes in the air.
    if (f.mode === 'swing') {
      const progress = Math.min(1, f.progress + 1/15);
      const x = f.fromX+(f.toX-f.fromX)*smooth(progress);
      return {...f,progress,x,y:FOX_LIMITS.groundY-Math.sin(Math.PI*progress)*.035,
        mode:progress === 1 ? 'planted' as const : 'swing' as const};
    }
    return f;
  });
}

function advance(state: FoxState, options: FoxOptions, tick: number,
  input: ReturnType<typeof validateInputs>): {state: FoxState; pounce: 'none'|'started'|'ignored-busy'} {
  let behavior = nextBehavior(state.behavior), pounce: 'none'|'started'|'ignored-busy' = 'none';
  let rootX = state.rootX, velocityX = state.velocityX, gait = state.gait;
  let feet = state.feet;
  if (input.wantsPounce) {
    // Busy is judged at input time; the last cooldown tick cannot steal a leap.
    if (reaction(state.behavior)) pounce = 'ignored-busy';
    else {
      const facing = options.facing === 'right' ? 1 : -1;
      const preferred = input.target.active ? input.target.x*.2-state.rootX : facing;
      const direction = Math.abs(preferred) < .025 ? facing : Math.sign(preferred);
      const distance = Math.min(options.pounceDistance, Math.max(.08, Math.abs(preferred)));
      const toX = clamp(rootX+direction*distance, FOX_LIMITS.rootMin, FOX_LIMITS.rootMax);
      behavior = {kind:'crouch',age:0,plan:Object.freeze({fromX:rootX,toX,options})};
      velocityX=0; pounce='started';
    }
  }
  if (reaction(behavior)) {
    velocityX = 0;
    if (behavior.kind === 'crouch') rootX = behavior.plan.fromX;
    else if (behavior.kind === 'airborne') {
      const u = behavior.age/behavior.plan.options.airTicks;
      rootX = behavior.plan.fromX+(behavior.plan.toX-behavior.plan.fromX)*smooth(u);
    } else rootX = behavior.plan.toX;
    // Stored gait feet are not used for the authored leap pose. Reset at landing
    // for a planted, deterministic handoff after recovery/cooldown.
    if (behavior.kind === 'landing' || behavior.kind === 'cooldown') feet=neutralFeet(rootX,behavior.plan.options);
  } else {
    // A captured leap may finish after the caller changed facing/scale. Replant
    // against the now-active morphology, otherwise feet stay on the wrong side.
    if(reaction(state.behavior) && (state.behavior.plan.options.facing!==options.facing
        || state.behavior.plan.options.scale!==options.scale)) {
      feet=neutralFeet(rootX,options);
    }
    const delta = input.target.active ? input.target.x*.2-rootX : 0;
    const desired = input.target.active ? clamp(delta*.08,-options.stalkSpeed,options.stalkSpeed) : 0;
    velocityX += (desired-velocityX)*.16;
    if (Math.abs(velocityX)<.000001) velocityX=0;
    const nextX = clamp(rootX+velocityX,FOX_LIMITS.rootMin,FOX_LIMITS.rootMax);
    const dx=nextX-rootX;
    rootX=nextX;
    gait=(gait+Math.abs(dx)/.15)%1;
    feet=walkFeet({...state,feet},rootX,dx,gait,options);
    behavior = !input.target.active ? {kind:'idle'} : Math.abs(delta)<.012 ? {kind:'sniff'} : {kind:'stalk'};
  }
  return {pounce,state:seal({...state,tick,lastSequence:input.sequence,target:input.target,
    rootX,velocityX,gait,feet,behavior,
    breathPhase:(state.breathPhase+TAU/240)%TAU,tailPhase:(state.tailPhase+TAU/330)%TAU})};
}

export function createFox(init: FoxCreateOptions = {}): FoxModel {
  plain(init,'create options');
  const {seed:initialSeed=17,paused:initialPaused=false,...patch}=init;
  let options=resolveFoxOptions(patch), seed=integer(initialSeed,0,0xffffffff,'seed');
  if (typeof initialPaused !== 'boolean') throw new TypeError('paused must be boolean');
  let state=initial(seed,options), paused=initialPaused, disposed=false;
  const alive=():void=>{ if(disposed)throw new Error('Fox is disposed'); };
  return Object.freeze({
    getOptions():FoxOptions {alive();return options;},
    getState():FoxState {alive();return state;},
    getPose():FoxPose {alive();return poseFox(state,options);},
    configure(patch:FoxOptionsInput):FoxOptions {
      alive(); const next=resolveFoxOptions(patch,options);
      if (!reaction(state.behavior) && (next.scale!==options.scale || next.facing!==options.facing)) {
        state=seal({...state,feet:neutralFeet(state.rootX,next)});
      }
      options=next;return options;
    },
    step(tick:number, inputs:readonly FoxInput[]=[]):FoxStepResult {
      alive();const input=validateInputs(state,tick,inputs);
      if(paused)return {kind:'paused',state,eventsAccepted:0,pounce:'none'};
      const result=advance(state,options,tick,input);state=result.state;
      return {kind:'advanced',state,eventsAccepted:inputs.length,pounce:result.pounce};
    },
    setPaused(value:boolean):void {alive();if(typeof value!=='boolean')throw new TypeError('paused must be boolean');paused=value;},
    isPaused():boolean {alive();return paused;},
    reset(nextSeed:number=seed):FoxState {
      alive();const checked=integer(nextSeed,0,0xffffffff,'seed');
      state=initial(checked,options);seed=checked;return state;
    },
    dispose():void {if(disposed)return;disposed=true;},
  });
}

/** A deliberate still alternative, never an implicit simulation step. */
export function staticFoxPose(options: FoxCreateOptions = {}, pose: FoxStaticPose = 'idle'): FoxPose {
  if (!['idle','sniff','crouch'].includes(pose)) throw new TypeError('Unknown static pose');
  const model=createFox(options), state=model.getState(), config=model.getOptions();
  let behavior:FoxBehavior = {kind:'idle'};
  if(pose==='sniff')behavior={kind:'sniff'};
  if(pose==='crouch')behavior={kind:'crouch',age:config.crouchTicks-1,plan:{fromX:0,toX:0,options:config}};
  const result=poseFox({...state,behavior,target:{active:pose==='sniff',x:.6,y:.2}},config);
  model.dispose();return result;
}

export function normalizeFoxPointer(clientX:number,clientY:number,
  rect:{left:number;top:number;width:number;height:number}):FoxPoint|null {
  finite(clientX,'clientX');finite(clientY,'clientY');
  // Native DOMRect has a prototype; this boundary accepts its structural fields.
  if(!rect||typeof rect!=='object')throw new TypeError('rectangle must be an object');
  for(const key of ['left','top','width','height'] as const)finite(rect[key],`rect.${key}`);
  if(rect.width<=0||rect.height<=0)return null;
  return {x:clamp((clientX-rect.left)/rect.width*2-1,-1,1),y:clamp((clientY-rect.top)/rect.height*2-1,-1,1)};
}

export const foxSpecies:FoxSpecies=Object.freeze({id:'fox',version:1,maxPolygons:48,maxVertices:1024,create:createFox});
