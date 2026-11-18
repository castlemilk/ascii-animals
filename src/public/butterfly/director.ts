/** Butterfly-local choreography. No browser, renderer, wall clock, or shared engine state. */
export type ButterflyScene = 'specimen' | 'morning' | 'nectar' | 'breeze' | 'roost';
export type ButterflyPath = 'meadow' | 'ribbon' | 'spiral';
export type ButterflyRole = 'auto' | 'forager' | 'scout' | 'basker' | 'wanderer';
export type ButterflyPointerMode = 'attract' | 'breeze' | 'off';
export type ButterflyCue = 'gather' | 'breeze' | 'rest';
export type ButterflyActivity =
  | Readonly<{kind:'flutter' | 'glide' | 'bask' | 'shelter' | 'recover'}>
  | Readonly<{kind:'inspect';target:'flower';flower:number}>
  | Readonly<{kind:'inspect';target:'invitation'}>
  | Readonly<{kind:'nectar' | 'perch'; flower:number}>;

export interface ButterflyDirectorOptions {
  scene?:ButterflyScene;
  count?:number;
  path?:ButterflyPath;
  roles?:readonly ButterflyRole[];
  sceneSeconds?:number;
  breeze?:number;
  spread?:number;
  pointerMode?:ButterflyPointerMode;
  showLabels?:boolean;
}
export type ButterflyDirectorConfig = Readonly<Required<ButterflyDirectorOptions>>;
export const BUTTERFLY_DIRECTOR_DEFAULTS:ButterflyDirectorConfig = Object.freeze({
  scene:'specimen', count:1, path:'meadow', roles:Object.freeze([]), sceneSeconds:32,
  breeze:.2, spread:1, pointerMode:'attract', showLabels:false
});
export interface ButterflySceneDescription {
  readonly id:ButterflyScene; readonly label:string; readonly description:string;
  readonly acts:readonly Readonly<{id:string;label:string}>[];
}
function scene(id:ButterflyScene,label:string,description:string,acts:readonly (readonly [string,string])[]):ButterflySceneDescription {
  return Object.freeze({id,label,description,acts:Object.freeze(acts.map(([id,label])=>Object.freeze({id,label})))});
}
export const BUTTERFLY_SCENES:readonly ButterflySceneDescription[] = Object.freeze([
  scene('specimen','Wing study','The original single butterfly, close enough to see the pattern.',[
    ['observe','Observe'],['approach','Approach'],['display','Patterned display'],['settle','Settle']]),
  scene('morning','First light','Warm the wings. Lift into the light. Find a place in the meadow.',[
    ['warm','Warm the wings'],['lift','First flight'],['explore','Explore the meadow'],['settle','Settle into sun']]),
  scene('nectar','Nectar rounds','Visitors inspect a bloom, sip, then take a different route home.',[
    ['arrive','Follow the scent'],['inspect','Inspect the flowers'],['sip','Nectar time'],['depart','Drift to another bloom']]),
  scene('breeze','Passing breeze','A ribbon of air lifts the garden, then leaves a pocket of quiet.',[
    ['listen','Read the air'],['ride','Ride the ribbon'],['shelter','Find shelter'],['return','Return to flowers']]),
  scene('roost','Evening roost','One last visit, a lantern-like ascent, then folded wings on stems.',[
    ['forage','The last forage'],['ascend','Lantern ascent'],['choose','Choose a stem'],['fold','Fold to rest']])
]);

const ROLES:readonly ButterflyRole[]=['auto','forager','scout','basker','wanderer'];
const PATHS:readonly ButterflyPath[]=['meadow','ribbon','spiral'];
const POINTERS:readonly ButterflyPointerMode[]=['attract','breeze','off'];
const CUES:readonly ButterflyCue[]=['gather','breeze','rest'];
const TAU=Math.PI*2;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(v:number)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const hash=(seed:number,id:number,salt:number)=>{
  let v=(seed^Math.imul(id+1,374761393)^Math.imul(salt+1,668265263))>>>0;
  v=Math.imul(v^(v>>>13),1274126177); return ((v^(v>>>16))>>>0)/4294967296;
};

/** Nested patches merge atomically; arrays are bounded, copied, and frozen. */
export function resolveButterflyDirectorOptions(input:ButterflyDirectorOptions={},base:ButterflyDirectorConfig=BUTTERFLY_DIRECTOR_DEFAULTS):ButterflyDirectorConfig {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Butterfly director must be an object');
  for(const key of Object.keys(input))if(!Object.hasOwn(BUTTERFLY_DIRECTOR_DEFAULTS,key))throw new TypeError(`Unknown butterfly director option ${key}`);
  const value={...base};
  for(const key of Object.keys(BUTTERFLY_DIRECTOR_DEFAULTS) as (keyof ButterflyDirectorOptions)[]){
    if(input[key]!==undefined)Object.defineProperty(value,key,{value:input[key],enumerable:true,writable:true,configurable:true});
  }
  for(const [key,lo,hi] of [['count',1,6],['sceneSeconds',18,60],['breeze',-1,1],['spread',.6,1.25]] as const){
    const n=value[key];
    if(typeof n!=='number'||!Number.isFinite(n)||n<lo||n>hi||(key==='count'&&!Number.isInteger(n)))throw new RangeError(`Invalid butterfly director ${key}`);
  }
  if(!BUTTERFLY_SCENES.some(s=>s.id===value.scene)||!PATHS.includes(value.path)||!POINTERS.includes(value.pointerMode)||typeof value.showLabels!=='boolean')throw new TypeError('Invalid butterfly director setting');
  if(!Array.isArray(value.roles)||value.roles.length>6)throw new TypeError('Butterfly roles must be an array of at most six roles');
  for(let i=0;i<value.roles.length;i++)if(!Object.hasOwn(value.roles,i)||!ROLES.includes(value.roles[i]!))throw new TypeError('Invalid butterfly role');
  return Object.freeze({...value,roles:Object.freeze([...value.roles])});
}

/** Normalize a complete public director configuration. */
export function normalizeButterflyDirectorOptions(input:ButterflyDirectorOptions={}):ButterflyDirectorConfig {
  return resolveButterflyDirectorOptions(input,BUTTERFLY_DIRECTOR_DEFAULTS);
}

export interface ButterflyFlower { readonly id:number;readonly x:number;readonly y:number }
export interface ButterflyGardenMember {
  readonly id:number;readonly role:Exclude<ButterflyRole,'auto'>;
  readonly activity:ButterflyActivity;
  readonly x:number;readonly y:number;readonly opening:number;readonly scale:number;
  readonly heading:number;readonly phase:number;
}
export interface ButterflyGardenState {
  readonly scene:ButterflyScene;readonly act:string;readonly actIndex:number;readonly actLabel:string;
  readonly progress:number;readonly cycle:number;readonly clock:number;
  readonly cue:ButterflyCue|'none';readonly members:readonly ButterflyGardenMember[];
  readonly flowers:readonly ButterflyFlower[];
  readonly pointer:Readonly<{active:boolean;x:number;y:number}>;
}
interface Actor {
  id:number;x:number;y:number;heading:number;opening:number;phase:number;size:number;
  activity:ButterflyActivity;
}
interface Aim {x:number;y:number;heading:number;activity:ButterflyActivity}
const FLOWERS:readonly ButterflyFlower[]=Object.freeze([
  [-.74,.46],[-.44,.62],[-.14,.42],[.17,.58],[.46,.42],[.75,.61]
].map(([x,y],id)=>Object.freeze({id,x:x!,y:y!})));
const AUTOMATIC:readonly Exclude<ButterflyRole,'auto'>[]=['forager','scout','basker','wanderer','forager','scout'];
const LANES=[-.68,-.23,.23,.68,-.45,.45] as const;
const FLOWER_ORDER=[0,2,3,5,1,4] as const;
const CUE_TICKS:Readonly<Record<ButterflyCue,number>>=Object.freeze({gather:300,breeze:300,rest:420});

/** Internal engine. Public callers use createButterflyModel / createButterflyArtwork. */
export function createGardenDirector(initial:ButterflyDirectorConfig,initialSeed:number){
  let options=initial,seed=initialSeed,clock=0,sceneTime=0,ticks=0;
  let pointer={active:false,x:0,y:0};
  let cue:Readonly<{kind:ButterflyCue;start:number;offset:number;x:number;y:number}>|null=null;
  let recoveringUntil=0;
  let actors:Actor[]=[];
  const role=(id:number):Exclude<ButterflyRole,'auto'>=>{
    const configured=options.roles[id];return configured&&configured!=='auto'?configured:AUTOMATIC[id]!;
  };
  function makeActor(id:number):Actor {
    return {id,x:options.count===1?0:LANES[id]!,y:-.24+(id%2)*.26,heading:0,opening:.85,
      phase:hash(seed,id,1)*TAU,size:.9+hash(seed,id,2)*.2,activity:Object.freeze({kind:'bask'})};
  }
  function stage(){
    const position=sceneTime/options.sceneSeconds;
    const cycle=Math.floor(position),progress=position-cycle;
    return {cycle,progress,index:Math.min(3,Math.floor(progress*4)),local:(progress*4)%1};
  }
  function flowerFor(id:number):ButterflyFlower {
    const cycle=stage().cycle;
    return FLOWERS[((options.count===1?2:FLOWER_ORDER[id]!)+cycle)%FLOWERS.length]!;
  }
  function flight(a:Actor,kind:'flutter'|'glide'|'recover'='flutter'):Aim {
    const phase=a.phase,t=clock, lane=options.count===1?0:LANES[a.id]!;
    const r=role(a.id);
    let x=lane*.82+Math.sin(t*.49+phase)*.12;
    let y=-.25+Math.cos(t*.71+phase)*.13+(a.id%2)*.12;
    if(options.path==='ribbon'){
      x=Math.sin(t*.22+phase)*.67;
      y=-.22+Math.sin(t*.44+phase)*.19+(a.id%2)*.08;
    } else if(options.path==='spiral'){
      const angle=t*.34+phase,radius=.22+(a.id%3)*.11;
      x=Math.cos(angle)*radius+lane*.26;y=-.19+Math.sin(angle)*radius*.68;
    }
    if(r==='scout'){y-=.13;x+=Math.sin(t*.73+phase)*.07;}
    if(r==='wanderer'&&options.path==='meadow'){x=lane*.65+Math.sin(t*.22+phase)*.18;y=-.19+Math.cos(t*.3+phase)*.18;}
    x=x*options.spread+options.breeze*Math.sin(t*.6+phase)*.075;
    return {x,y,heading:Math.sin(t*.55+phase)*.35,activity:Object.freeze({kind})};
  }
  function bloom(a:Actor,kind:'inspect'|'nectar'|'perch'|'bask',flower=flowerFor(a.id)):Aim {
    const inspect=kind==='inspect';
    return {x:flower.x+(inspect?Math.sin(clock*1.6+a.phase)*.07:0),
      y:flower.y-(inspect?.31:kind==='bask'?.22:.19),
      heading:kind==='nectar'||inspect?Math.PI+Math.sin(clock*.8+a.phase)*.12:Math.sin(a.phase)*.16,
      activity:kind==='bask'?Object.freeze({kind}):kind==='inspect'?Object.freeze({kind,target:'flower',flower:flower.id}):Object.freeze({kind,flower:flower.id})};
  }
  function autonomous(a:Actor):Aim {
    const s=stage(),r=role(a.id), flying=flight(a,r==='wanderer'?'glide':'flutter');
    if(options.scene==='specimen')return flying;
    if(options.scene==='morning'){
      if(s.index===0){
        if(r==='scout')return {...flying,y:flying.y-.10};
        if(r==='wanderer')return flight(a,'glide');
        return bloom(a,r==='forager'&&s.local>.7?'inspect':'bask');
      }
      if(s.index===1){const from=bloom(a,'bask'),e=smooth(s.local*1.7-hash(seed,a.id,4)*.35);return {...flying,x:mix(from.x,flying.x,e),y:mix(from.y,flying.y,e)};}
      if(s.index===2){
        if(r==='basker')return bloom(a,'bask');
        if(r==='forager')return bloom(a,s.local<.34?'inspect':'nectar');
        return flying;
      }
      return bloom(a,r==='scout'&&s.local<.6?'inspect':'bask');
    }
    if(options.scene==='nectar'){
      if(s.index===0)return r==='basker'?bloom(a,'bask'):flying;
      if(s.index===1)return r==='wanderer'&&s.local<.5?flight(a,'glide'):bloom(a,'inspect');
      if(s.index===2)return r==='scout'&&s.local>.65?flying:r==='basker'?bloom(a,'bask'):bloom(a,'nectar');
      if(r==='basker')return bloom(a,'bask');
      const from=bloom(a,'nectar'),e=smooth(s.local*1.6);
      return {...flight(a,'glide'),x:mix(from.x,flying.x,e),y:mix(from.y,flying.y,e)};
    }
    if(options.scene==='breeze'){
      if(s.index===0)return r==='basker'?bloom(a,'bask'):flying;
      if(s.index===1)return {x:(options.count===1?0:LANES[a.id]!)*.96+Math.sin(clock*.38+a.phase)*.06,
        y:-.32+Math.cos(clock*.56+a.id*1.3)*.16,
        heading:.32*Math.sin(clock*.28+a.phase)+(options.breeze<0?-.16:.16),activity:Object.freeze({kind:'glide'})};
      if(s.index===2){const f=flowerFor(a.id);return {x:f.x,y:f.y-.12,heading:options.breeze*.3,activity:Object.freeze({kind:'shelter'})};}
      return r==='basker'?bloom(a,'bask'):bloom(a,s.local<.45?'inspect':'nectar');
    }
    // Evening roost: each visitor chooses a different stem; the final pose is a quiet folded silhouette.
    if(s.index===0)return r==='scout'?flying:bloom(a,r==='basker'?'bask':'nectar');
    if(s.index===1)return {...flight(a,'glide'),x:(options.count===1?0:LANES[a.id]!)*.92,
      y:-.41+Math.sin(clock*.5+a.phase)*.09,heading:Math.sin(clock*.7+a.phase)*.2};
    if(s.index===2)return bloom(a,'inspect');
    return bloom(a,'perch');
  }
  function aim(a:Actor):Aim {
    let result=autonomous(a);
    const r=role(a.id);
    if(cue){
      const age=ticks-cue.start+cue.offset;
      const duration=CUE_TICKS[cue.kind];
      if(age<duration-70){
        if(cue.kind==='rest')return bloom(a,age<100?'inspect':'perch');
        if(cue.kind==='breeze'){
          if(age<150)return {x:clamp(a.x+(options.breeze<0?-.22:.22),-.79,.79),y:-.42+(a.id%3)*.13,
            heading:(options.breeze<0?-.5:.5),activity:Object.freeze({kind:age<55?'flutter':'glide'})};
          const f=flowerFor(a.id);return {x:f.x,y:f.y-.12,heading:options.breeze*.25,activity:Object.freeze({kind:'shelter'})};
        }
        // Nectar invitations interest foragers/scouts; a basker keeps its patch of sun.
        if(r!=='basker'||options.count===1){
          const angle=a.phase, radius=.12+(a.id%2)*.1;
          return {x:cue.x+Math.cos(angle)*radius,y:cue.y+Math.sin(angle)*radius,
            heading:Math.atan2(cue.x-a.x,-(cue.y-a.y)),activity:Object.freeze({kind:'inspect',target:'invitation'})};
        }
      }else result={...result,activity:Object.freeze({kind:'recover'})};
    }else if(pointer.active&&options.pointerMode!=='off'){
      const distance=Math.hypot(pointer.x-a.x,pointer.y-a.y);
      if(options.pointerMode==='attract'&&distance<.74&&(r==='forager'||r==='scout'||options.count===1)){
        result={x:pointer.x+Math.cos(a.phase)*.15,y:pointer.y-.12+Math.sin(a.phase)*.09,
          heading:Math.atan2(pointer.x-a.x,-(pointer.y-a.y)),activity:Object.freeze({kind:'inspect',target:'invitation'})};
      }else if(options.pointerMode==='breeze'&&distance<.9){
        result={x:result.x+(a.x-pointer.x)*.26,y:result.y-.15,
          heading:clamp((a.x-pointer.x)*.7,-.7,.7),activity:Object.freeze({kind:'glide'})};
      }
    }else if(ticks<recoveringUntil)result={...result,activity:Object.freeze({kind:'recover'})};
    return result;
  }
  function open(a:Actor,kind:ButterflyActivity['kind']){
    const beat=.5+.5*Math.cos(clock*(7.4+hash(seed,a.id,7)*2)+a.phase);
    switch(kind){
      case 'perch':return .28+.035*Math.cos(clock*.6+a.phase);
      case 'shelter':return .31;
      case 'bask':return .87+.1*Math.sin(clock*.45+a.phase);
      case 'glide':return .94+.04*Math.sin(clock*.8+a.phase);
      case 'nectar':return .45+beat*.32;
      case 'inspect':return .43+beat*.55;
      default:return .36+beat*.62;
    }
  }
  function pose(snap=false){
    const aims=actors.map(aim);
    // A bounded personal-space nudge keeps passing wings readable without making a rigid formation.
    if(!snap)for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
      const a=actors[i]!,b=actors[j]!,dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
      if(d<.22){const push=(.22-d)*.18,ux=d>.001?dx/d:(i%2?-1:1),uy=d>.001?dy/d:0;
        aims[i]!.x+=ux*push;aims[j]!.x-=ux*push;aims[i]!.y+=uy*push;aims[j]!.y-=uy*push;}
    }
    for(let i=0;i<actors.length;i++){
      const a=actors[i]!,target=aims[i]!,rate=target.activity.kind==='nectar'||target.activity.kind==='perch'?.035:.045;
      a.x=mix(a.x,clamp(target.x,-.78,.78),snap?1:rate);
      a.y=mix(a.y,clamp(target.y,-.56,.51),snap?1:rate);
      const delta=Math.atan2(Math.sin(target.heading-a.heading),Math.cos(target.heading-a.heading));
      a.heading=snap?target.heading:a.heading+delta*.04;
      const opening=open(a,target.activity.kind);
      a.opening=snap?opening:mix(a.opening,opening,.36);a.activity=target.activity;
    }
  }
  function reset(){clock=0;sceneTime=0;ticks=0;cue=null;pointer={active:false,x:0,y:0};recoveringUntil=0;actors=Array.from({length:options.count},(_,id)=>makeActor(id));pose(true);}
  reset();
  return Object.freeze({
    step(speed:number){ticks++;clock+=speed/60;sceneTime+=speed/60;if(cue&&ticks-cue.start+cue.offset>=CUE_TICKS[cue.kind])cue=null;pose();},
    configure(next:ButterflyDirectorConfig,nextSeed:number){
      const sceneChanged=next.scene!==options.scene,seedChanged=seed!==nextSeed;
      if(!sceneChanged&&next.sceneSeconds!==options.sceneSeconds)sceneTime=sceneTime/options.sceneSeconds*next.sceneSeconds;
      options=next;seed=nextSeed;
      if(seedChanged){reset();return;}
      if(sceneChanged){sceneTime=0;cue=null;pointer={active:false,x:0,y:0};recoveringUntil=0;}
      actors=Array.from({length:options.count},(_,id)=>actors[id]??makeActor(id));
      // Keep surviving identities/positions; update roles and visible poses immediately.
      if(sceneChanged)pose(true);else for(const a of actors)a.activity=aim(a).activity;
    },
    guide(x:number,y:number){pointer={active:true,x,y};},
    release(cancelCue=true){if(pointer.active||(cue&&cancelCue))recoveringUntil=ticks+90;pointer={active:false,x:0,y:0};if(cancelCue)cue=null;},
    cue(kind:ButterflyCue,poster=false){
      if(!CUES.includes(kind))throw new TypeError('Invalid butterfly cue');
      if(cue?.kind===kind&&!poster)return;
      cue=Object.freeze({kind,start:ticks,offset:poster?kind==='breeze'?170:120:0,
        x:pointer.active?pointer.x:0,y:pointer.active?pointer.y:-.14});
      if(poster)pose(true);else for(const a of actors)a.activity=aim(a).activity;
    },
    nextAct(poster=false){
      const s=stage();sceneTime=(s.cycle+(s.index===3?1:0)+(s.index+1)%4/4)*options.sceneSeconds+.000001;
      cue=null;recoveringUntil=0;pointer={active:false,x:0,y:0};
      // Jumping acts is an explicit composition edit. Live changes ease; still changes select a tableau.
      if(poster)pose(true);else for(const a of actors)a.activity=aim(a).activity;
    },
    still(){pose(true);},reset,
    getState():ButterflyGardenState {
      const s=stage(),description=BUTTERFLY_SCENES.find(item=>item.id===options.scene)!,act=description.acts[s.index]!;
      const baseScale=options.count===1?.56:options.count<=3?.44:options.count===4?.40:.34;
      return Object.freeze({scene:options.scene,act:act.id,actLabel:act.label,actIndex:s.index,progress:s.progress,cycle:s.cycle,clock,
        cue:cue?.kind??'none',pointer:Object.freeze({...pointer}),flowers:FLOWERS,
        members:Object.freeze(actors.map(a=>Object.freeze({id:a.id,role:role(a.id),activity:a.activity,
          x:a.x,y:a.y,heading:a.heading,opening:clamp(a.opening,.25,1),phase:a.phase,scale:baseScale*a.size})))});
    }
  });
}
