import { getBrowserScheduler } from '../core/scheduler.js';
/** Borrowed scheduler subscription; controller never owns or disposes it. */
export interface CrabFrameSource { subscribe(callback:(timestamp:number)=>void):()=>void }

export type CrabScene = 'study' | 'forage' | 'signals' | 'tide';
export type CrabRole = 'shy' | 'curious' | 'territorial';
export type CrabBeat = 'arrive' | 'forage' | 'signal' | 'challenge' | 'retreat' | 'shelter' | 'return';
export type CrabAction = 'forage' | 'signal' | 'shelter';
export type CrabFormation = 'arc' | 'terraces' | 'shoreline';
export interface CrabResidentOptions { readonly role?:CrabRole; readonly label?:string; readonly size?:number }

export interface CrabOptions {
  columns?: number; rows?: number; seed?: number; speed?: number; scale?: number;
  sway?: number; facing?: 'left' | 'right'; behavior?: 'scuttle' | 'curious' | 'guard';
  palette?: 'brass' | 'lagoon' | 'rose'; paused?: boolean;
  reducedMotion?: 'system' | 'ignore';
  /** The original single-crab study remains the default. Theatre is opt-in. */
  scene?:CrabScene; count?:number; formation?:CrabFormation; cast?:readonly CrabResidentOptions[];
  director?:'auto'|'manual'; actDuration?:number; tide?:number; current?:number; labels?:boolean;
}
export type CrabConfig = Readonly<Required<CrabOptions>>;
export const CRAB_DEFAULTS: CrabConfig = Object.freeze({ columns:120, rows:50, seed:7,
  speed:1, scale:1, sway:.18, facing:'left', behavior:'scuttle', palette:'brass', paused:false, reducedMotion:'system',
  scene:'study',count:1,formation:'arc',cast:Object.freeze([]),director:'auto',actDuration:240,tide:.35,current:.35,labels:false });
const ranges = { columns:[80,180], rows:[32,90], seed:[0,2147483647], speed:[.25,2], scale:[.6,1.3], sway:[0,.4],count:[1,5],actDuration:[120,720],tide:[0,1],current:[-1,1] } as const;
function resolve(patch: CrabOptions, base: CrabConfig): CrabConfig {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Crab options must be an object');
  for(const key of Object.keys(patch)) if(!Object.hasOwn(CRAB_DEFAULTS,key)) throw new TypeError(`Unknown crab option ${key}`);
  const candidate = {...base};
  for(const key of Object.keys(CRAB_DEFAULTS) as (keyof CrabOptions)[]) {
    const value=patch[key]; if(value!==undefined) Object.defineProperty(candidate,key,{value,enumerable:true,writable:true,configurable:true});
  }
  for(const [key,[lo,hi]] of Object.entries(ranges)) {
    const value=candidate[key as keyof typeof ranges];
    if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi||(['columns','rows','seed','count','actDuration'].includes(key)&&!Number.isInteger(value))) throw new RangeError(`Invalid ${key}`);
  }
  if(!['left','right'].includes(candidate.facing)||!['scuttle','curious','guard'].includes(candidate.behavior)||!['brass','lagoon','rose'].includes(candidate.palette)||!['system','ignore'].includes(candidate.reducedMotion)||typeof candidate.paused!=='boolean') throw new TypeError('Invalid crab setting');
  if(!['study','forage','signals','tide'].includes(candidate.scene)||!['arc','terraces','shoreline'].includes(candidate.formation)||!['auto','manual'].includes(candidate.director)||typeof candidate.labels!=='boolean')throw new TypeError('Invalid crab director setting');
  if(!Array.isArray(candidate.cast)||candidate.cast.length>5)throw new RangeError('Cast must contain at most five residents');
  candidate.cast=Object.freeze(Array.from(candidate.cast,entry=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new TypeError('Invalid cast entry');
    for(const key of Object.keys(entry))if(!['role','label','size'].includes(key))throw new TypeError(`Unknown cast option ${key}`);
    const copy:CrabResidentOptions={...entry};
    if(copy.role!==undefined&&!['shy','curious','territorial'].includes(copy.role))throw new TypeError('Invalid crab role');
    if(copy.label!==undefined&&(typeof copy.label!=='string'||!/^[\x20-\x7e]{1,12}$/.test(copy.label)||!copy.label.trim()))throw new TypeError('Labels must be 1–12 printable ASCII characters');
    if(copy.size!==undefined&&(typeof copy.size!=='number'||!Number.isFinite(copy.size)||copy.size<.8||copy.size>1.2))throw new RangeError('Resident size must be .8–1.2');
    return Object.freeze(copy);
  }));
  return Object.freeze(candidate);
}
/** The base-taking merge helper is private; all public configuration is validated. */
export function normalizeCrabOptions(patch: CrabOptions = {}): CrabConfig { return resolve(patch,CRAB_DEFAULTS); }
export interface CrabState { readonly tick:number; readonly responseTick:number|null; readonly targetX:number; readonly targetY:number }
export type CrabPhase = 'idle'|'notice'|'defend'|'settle';
export interface CrabCell { readonly glyph:string; readonly tone:number; readonly owner?:number; readonly layer?:'water'|'sand'|'rock'|'crab'|'label'|'cue' }
export interface CrabFrame { readonly columns:number; readonly rows:number; readonly cells:readonly CrabCell[]; readonly text:string; readonly phase:CrabPhase }
export interface CrabModel {
  getOptions():CrabConfig; getState():CrabState; getPhase():CrabPhase;
  configure(patch:CrabOptions):void; advanceTicks(ticks:number):void; guide(x:number,y:number):void; greet(poster?:boolean):void; reset():void;
  frame():CrabFrame;
  getScene():CrabSceneState; select(id:number):void; cue(action:CrabAction,id?:number,poster?:boolean):void;
  setBeat(beat:CrabBeat,poster?:boolean):void; nextBeat(poster?:boolean):void; clearGuide():void;
}
const TAU=Math.PI*2, clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function createCrabModel(input:CrabOptions={}):CrabModel {
  let options=normalizeCrabOptions(input),tick=0,responseTick:number|null=null,targetX=0,targetY=0;
  const theatre=createCrabDirector(()=>options,()=>tick);
  const state=():CrabState=>Object.freeze({tick,responseTick,targetX,targetY});
  const phase=():CrabPhase=>responseTick===null?'idle':tick-responseTick<45?'notice':tick-responseTick<110?'defend':'settle';
  return Object.freeze({getOptions:()=>options,getState:state,getPhase:phase,
    configure(patch:CrabOptions){const before=options;options=resolve(patch,options);theatre.configure(before);},
    advanceTicks(ticks:number){if(!Number.isInteger(ticks)||ticks<0||ticks>600)throw new RangeError('Ticks must be an integer0..600');for(let i=0;i<ticks;i++){tick++;if(options.scene!=='study')theatre.step();}if(responseTick!==null&&tick-responseTick>=180)responseTick=null;},
    guide(x:number,y:number){if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Guide requires finite normalized coordinates');targetX=clamp(x,-1,1);targetY=clamp(y,-1,1);theatre.guide(targetX,targetY);},
    greet(poster=false){if(responseTick===null){responseTick=tick-(poster?70:0);if(options.scene!=='study')theatre.cue('signal',undefined,poster);}},reset(){tick=0;responseTick=null;targetX=targetY=0;theatre.reset();},
    frame(){return options.scene==='study'?renderCrab(options,state(),phase()):renderTidepool(options,theatre.snapshot(),phase(),tick);},
    getScene:theatre.snapshot,select:theatre.select,cue:theatre.cue,setBeat:theatre.setBeat,nextBeat:theatre.nextBeat,
    clearGuide(){targetX=targetY=0;theatre.clearGuide();}
  });
}
export type CrabActivity = 'rest'|'scuttle'|'forage'|'signal'|'retreat'|'shelter'|'return'|'inspect'|'groom'|'brace';
/** Discriminant is deliberately separate from the unchanged legacy CrabPhase. */
export type CrabBehaviorState = { [K in CrabActivity]:Readonly<{kind:K;progress:number}> }[CrabActivity];
export interface CrabFoot { readonly x:number; readonly y:number; readonly planted:boolean; readonly lift:number }
export interface CrabResidentState {
  readonly id:number; readonly label:string; readonly role:CrabRole; readonly size:number;
  readonly x:number; readonly y:number; readonly home:Readonly<{x:number;y:number}>;
  readonly patch:Readonly<{x:number;y:number}>; readonly behavior:CrabBehaviorState;
  readonly leftClaw:number; readonly rightClaw:number; readonly gazeX:number; readonly gazeY:number;
  readonly crouch:number; readonly feet:readonly CrabFoot[];
}
export interface CrabSceneState {
  readonly scene:CrabScene; readonly beats:readonly CrabBeat[]; readonly beat:CrabBeat; readonly beatIndex:number;
  readonly progress:number; readonly cycle:number; readonly tideLevel:number; readonly current:number;
  readonly selectedId:number; readonly actors:readonly CrabResidentState[];
  readonly guide:Readonly<{active:boolean;x:number;y:number}>;
}
const CRAB_BEATS:Readonly<Record<CrabScene,readonly CrabBeat[]>>=Object.freeze({
  study:Object.freeze(['arrive'] as CrabBeat[]),forage:Object.freeze(['arrive','forage','signal','return'] as CrabBeat[]),
  signals:Object.freeze(['arrive','signal','challenge','return'] as CrabBeat[]),tide:Object.freeze(['forage','retreat','shelter','return'] as CrabBeat[])
});
const RESIDENTS:readonly Readonly<{label:string;role:CrabRole}>[]=Object.freeze([
  {label:'Pip',role:'curious'},{label:'Moss',role:'shy'},{label:'Brine',role:'territorial'},
  {label:'Dot',role:'curious'},{label:'Flint',role:'territorial'}
]);
const smooth=(n:number)=>{n=clamp(n,0,1);return n*n*(3-2*n);};
function crabRadius(o:CrabConfig,size:number){
  // Theatre keeps about 20 columns of silhouette even at 80-column/5-resident
  // density. Scale still applies above this legibility floor; never drop a crab.
  const requested=(o.count===1?.20:o.count===2?.14:o.count===3?.112:.094)*o.scale*size;
  return Math.min(Math.max(requested,10.6/(o.columns-1)),.26/(o.columns*.56/o.rows));
}
interface MovingFoot { x:number;y:number;planted:boolean;lift:number;fromX:number;fromY:number;toX:number;toY:number;swing:number }
interface Resident {
  id:number;label:string;role:CrabRole;size:number;x:number;y:number;homeX:number;homeY:number;patchX:number;patchY:number;
  vx:number;vy:number;gait:number;feet:MovingFoot[];kind:CrabActivity;progress:number;leftClaw:number;rightClaw:number;gazeX:number;gazeY:number;crouch:number;
  action:null|{kind:CrabAction;start:number;x:number;y:number;originX:number;originY:number}; replyAt:number|null;
}
/** Authored display: prepare, lead, answer, hold, close, settle. No new public phase. */
function clawDisplay(age:number):{left:number;right:number;crouch:number} {
  const rise=(start:number,end:number)=>smooth((age-start)/(end-start));
  const left=-.16*(1-rise(18,34))+rise(24,74)*(1-rise(157,238));
  const right=-.12*(1-rise(30,48))+.82*rise(44,94)*(1-rise(175,254));
  return {left,right,crouch:.18*rise(0,14)*(1-rise(26,62))};
}
/** Species-local director. One cue and one delayed reply per resident, never an event queue. */
function createCrabDirector(options:()=>CrabConfig,tick:()=>number){
  let clock=0,cycle=0,selectedId=0,guideActive=false,guideX=0,guideY=0;
  let actors:Resident[]=[];
  const beats=()=>CRAB_BEATS[options().scene];
  const beatIndex=()=>Math.min(beats().length-1,Math.floor(clock/options().actDuration));
  const beat=()=>beats()[beatIndex()]!;
  const progress=()=>clock%options().actDuration/options().actDuration;
  function water(){const o=options(),p=smooth(progress());if(o.scene!=='tide')return o.tide;
    const amount=beat()==='retreat'?p:beat()==='shelter'?1:beat()==='return'?1-p:0;
    return clamp(o.tide*.5+amount*.65,0,1);
  }
  function anchor(id:number):[number,number]{
    const o=options(),n=o.count;
    if(n===1)return [0,.16];
    if(n===2)return [id===0?-.43:.43,o.formation==='terraces'?(id===0?-.12:.37):.22];
    const rows:readonly (readonly [number,number])[]=o.formation==='terraces'
      ?[[-.54,-.22],[.48,-.04],[-.12,.45],[.54,.55],[-.58,.52]]
      :n===3?(o.formation==='shoreline'?[[-.58,.25],[0,.25],[.58,.25]]:[[-.58,.34],[0,-.02],[.58,.34]])
      :[[-.58,-.16],[0,-.24],[.58,-.16],[-.35,.48],[.35,.48]];
    return [...rows[id]!] as [number,number];
  }
  function footOffset(a:Resident,k:number):[number,number]{
    const o=options(),side=k<4?-1:1,j=k%4,r=crabRadius(o,a.size),ratio=o.columns*.56/o.rows;
    return [side*(1.88-j*.11)*r,(-.13+j*.33)*r*ratio];
  }
  function plant(a:Resident){a.feet=Array.from({length:8},(_,k)=>{const [x,y]=footOffset(a,k);return {x:a.x+x,y:a.y+y,planted:true,lift:0,fromX:0,fromY:0,toX:0,toY:0,swing:0};});}
  function syncCast(reseed=false){
    const o=options();actors=Array.from({length:o.count},(_,id)=>{
      const c=o.cast[id],d=RESIDENTS[id]!,old=reseed?undefined:actors[id],role=c?.role??d.role;
      const [ax,py]=anchor(id),direction=Math.sign(ax)||-1,px=ax-direction*.04;
      // Cover sits laterally beside the feeding patch. A retreat reads as a
      // sideways journey, rather than a short diagonal slide underneath a badge.
      const span=o.count===1?.40:o.count===2?.13:.09,homeX=ax+direction*span,homeY=py-.045;
      const a:Resident=old??{id,label:'',role,size:1,x:homeX,y:homeY,homeX,homeY,patchX:px,patchY:py,vx:0,vy:0,gait:((o.seed+id*17)%47)/47,feet:[],kind:'rest',progress:0,leftClaw:0,rightClaw:0,gazeX:0,gazeY:0,crouch:0,action:null,replyAt:null};
      a.label=c?.label??d.label;a.role=role;a.size=c?.size??(id===1?.9:id===2?1.06:1);
      const r=crabRadius(o,a.size),ratio=o.columns*.56/o.rows;
      const xLimit=.96-r*2.08,minY=-.83+r*ratio*1.5,maxY=.82-r*ratio;
      // Anchors obey the same fitted bounds as travel, including large casts
      // after resize. A shelter must never sit outside its resident's reach.
      a.homeX=clamp(homeX,-xLimit,xLimit);a.homeY=clamp(homeY,minY,maxY);
      a.patchX=clamp(px,-xLimit,xLimit);a.patchY=clamp(py,minY,maxY);
      if(!old){a.x=a.homeX;a.y=a.homeY;plant(a);}
      return a;
    });selectedId=Math.min(selectedId,o.count-1);
  }
  function plan(a:Resident){
    const o=options(),b=beat(),p=progress(),age=tick(),offset=(o.seed*13+a.id*79)%480,idle=(age+offset)%480;
    let x=a.patchX,y=a.patchY,kind:CrabActivity='rest',pr=p,left=0,right=0,crouch=0;
    const callAge=((o.director==='manual'?age:clock)%o.actDuration)-(a.role==='territorial'?0:a.role==='curious'?26:48);
    const display=clawDisplay(callAge*300/Math.max(120,o.actDuration-48));
    if(b==='arrive'){kind='scuttle';if(a.role==='shy'&&p<.3){x=a.homeX;y=a.homeY;kind='inspect';crouch=.3;}}
    if(b==='forage'){
      const forage=(idle%210)/210;pr=forage;
      if(forage<.62){kind='forage';left=-.65*Math.sin(forage/.62*Math.PI);right=.12;}
      else if(forage<.8){kind='groom';right=.35;left=.15;}
      else{kind='inspect';x+=Math.sin(offset)*o.sway*.24;}
    }
    if(b==='signal'){
      kind=callAge>=0?'signal':a.role==='shy'?'inspect':'rest';left=display.left;right=display.right;crouch=display.crouch;
      if(a.role==='shy'){x=a.homeX;y=a.homeY;left*=.5;right*=.5;}
    }
    if(b==='challenge'){
      if(a.role==='territorial'){kind='signal';const show=clawDisplay(p*300);left=show.left;right=show.right;crouch=show.crouch;}
      else if(a.role==='shy'){kind='retreat';x=a.homeX;y=a.homeY;crouch=.45;}
      else{kind='inspect';x-=Math.sign(a.patchX||1)*.055;left=.25;}
    }
    if(b==='retreat'){
      if(p<.18+a.id*.035){kind='brace';left=-.2;right=-.2;crouch=.35;}
      else{kind='retreat';x=a.homeX+o.current*.035;y=a.homeY;left=-.3;right=-.3;crouch=.6;}
    }
    if(b==='shelter'){x=a.homeX;y=a.homeY;kind=p>.55+a.id*.04?'inspect':'shelter';crouch=kind==='shelter'?1:.55;left=-.3;right=-.3;}
    if(b==='return'){
      if(o.scene==='tide'){const wait=a.id*.09+(a.role==='shy'?.13:0);if(p<wait){kind='inspect';x=a.homeX;y=a.homeY;crouch=.55;}else kind='return';}
      else{kind='return';x=a.homeX;y=a.homeY;if(p>.7){kind=idle<240?'groom':'inspect';left=kind==='groom'?.3:0;right=.1;}}
    }
    // Quiet individual motives remain visible between the larger authored gestures.
    if(kind==='rest'&&idle<95){kind='groom';left=.25;right=-.1;}
    if(kind==='rest'&&idle>=95&&idle<160){kind='inspect';right=.12;}
    if(guideActive&&Math.hypot(guideX-a.x,(guideY-a.y)*.7)<.38&&!['retreat','shelter','brace'].includes(kind)){
      if(a.role==='shy'){x=a.homeX;y=a.homeY;kind='retreat';crouch=.45;}
      else if(a.role==='territorial'){kind='signal';left=.9;right=.25;}
      else{kind='inspect';x=clamp(guideX,a.patchX-.12,a.patchX+.12);y=clamp(guideY,a.patchY-.06,a.patchY+.09);left=.15;right=.1;}
    }
    if(a.action){
      const actionAge=age-a.action.start,q=clamp(actionAge/300,0,1);pr=q;
      if(a.action.kind==='forage'){
        if(q<.28){
          x=actionAge<18?a.action.originX:a.action.x;y=actionAge<18?a.action.originY:a.action.y;kind='scuttle';
          crouch=.16*(1-smooth((actionAge-18)/30));left=-.18;right=-.12;
        }
        else if(q<.75){x=a.action.x;y=a.action.y;kind='forage';left=-.66*(.45+.55*Math.sin((q-.28)/.47*TAU)**2);right=.1;}
        else{kind='return';}
      }else if(a.action.kind==='signal'){
        x=a.action.originX;y=a.action.originY;kind=actionAge<264?'signal':'rest';
        const show=clawDisplay(actionAge);left=show.left;right=show.right;crouch=show.crouch;
      }else{
        if(actionAge<18){x=a.action.originX;y=a.action.originY;kind='brace';crouch=.28;}
        else if(q<.30){x=a.homeX;y=a.homeY;kind='retreat';crouch=.3+.55*smooth((actionAge-18)/72);}
        else if(q<.65){x=a.homeX;y=a.homeY;kind=q<.5?'shelter':'inspect';crouch=q<.5?1:.58;}
        else{kind='return';crouch=.58*(1-smooth((actionAge-195)/70));}
        left=-.34;right=-.26;
      }
    }
    if(!a.action&&(kind==='scuttle'||kind==='return')&&Math.hypot(x-a.x,y-a.y)<.002){kind=idle<110?'groom':idle<190?'inspect':'rest';if(kind==='groom'){left=.25;right=.08;}}
    const r=crabRadius(o,a.size),ratio=o.columns*.56/o.rows;
    x=clamp(x,-.96+r*2.08,.96-r*2.08);y=clamp(y,-.83+r*ratio*1.5,.82-r*ratio);
    return {x,y,kind,pr,left,right,crouch};
  }
  function pose(a:Resident,snap=false){
    const o=options(),p=plan(a),gain=snap?1:.14;
    a.kind=p.kind;a.progress=p.pr;a.leftClaw+=(p.left-a.leftClaw)*gain;a.rightClaw+=(p.right-a.rightClaw)*gain;a.crouch+=(p.crouch-a.crouch)*gain;
    const gazeX=guideActive?clamp((guideX-a.x)*3,-1,1):Math.sin((tick()+a.id*91)*.017)*.45;
    const gazeY=guideActive?clamp((guideY-a.y)*3,-1,1):Math.cos((tick()+a.id*113)*.013)*.25;
    a.gazeX+=(gazeX-a.gazeX)*gain;a.gazeY+=(gazeY-a.gazeY)*gain;
    if(snap){a.x=p.x;a.y=p.y;a.vx=a.vy=0;plant(a);return;}
    const max=(p.kind==='retreat'?.0065:p.kind==='scuttle'?.0072:.0045)*o.speed*(a.role==='shy'?.86:1),dx=p.x-a.x,dy=p.y-a.y;
    a.vx+=clamp(clamp(dx*.10,-max,max)-a.vx,-.0004,.0004);
    a.vy+=clamp(clamp(dy*.08,-max*.58,max*.58)-a.vy,-.00016,.00016);
    if(Math.abs(dx)<.00025)a.vx=0;if(Math.abs(dy)<.00025)a.vy=0;
    a.x+=a.vx;a.y+=a.vy;
    const moving=Math.hypot(a.vx,a.vy)>.00008;
    if(moving)a.gait+=o.speed/48;
    const r=crabRadius(o,a.size),ratio=o.columns*.56/o.rows;
    for(let k=0;k<8;k++){
      const f=a.feet[k]!,phase=(a.gait+(k%2)*.5+(k<4?0:.5))%1;
      if(f.planted){
        // A fresh swing always starts at ground level, even after stop/restart.
        // The two support groups cannot overlap: swing is shorter than half-cycle.
        if(!moving||phase<.68||phase>.68+o.speed/48)continue;
        const [ox,oy]=footOffset(a,k);f.fromX=f.x;f.fromY=f.y;
        f.toX=a.x+ox+a.vx*8;f.toY=a.y+oy+a.vy*8;f.swing=0;f.planted=false;
      }else{
        f.swing=Math.min(1,f.swing+o.speed/15);
        const q=smooth(f.swing);f.x=f.fromX+(f.toX-f.fromX)*q;f.y=f.fromY+(f.toY-f.fromY)*q;
        f.lift=Math.sin(f.swing*Math.PI)*r*ratio*.22;
        // Finish the airborne foot before planting, even if the body has stopped.
        if(f.swing===1){f.x=f.toX;f.y=f.toY;f.lift=0;f.planted=true;}
      }
    }
  }
  function validateId(id:number){if(!Number.isInteger(id)||id<0||id>=actors.length)throw new RangeError('Resident id is outside this cast');}
  function cue(action:CrabAction,id=selectedId,poster=false){
    if(!['forage','signal','shelter'].includes(action))throw new TypeError('Unknown crab cue');validateId(id);
    const a=actors[id]!;
    if(a.action&&!poster)return;
    const lure=action==='forage'&&guideActive;
    a.action={kind:action,start:tick()-(poster?120:0),x:lure?clamp(guideX,a.patchX-.14,a.patchX+.14):a.x,y:lure?clamp(guideY,a.patchY-.08,a.patchY+.08):a.y,originX:a.x,originY:a.y};
    a.replyAt=null;
    if(action==='signal'&&!poster)for(const other of actors)if(other.id!==id&&!other.action&&other.replyAt===null)other.replyAt=tick()+55+other.id*25;
    if(poster)pose(a,true);
  }
  function setBeat(next:CrabBeat,poster=false){const i=beats().indexOf(next);if(i<0)throw new RangeError('Beat does not belong to this scene');clock=(i+(poster?.5:0))*options().actDuration;for(const a of actors){a.action=null;a.replyAt=null;if(poster)pose(a,true);}}
  function snapshot():CrabSceneState{return Object.freeze({scene:options().scene,beats:beats(),beat:beat(),beatIndex:beatIndex(),progress:progress(),cycle,tideLevel:water(),current:options().current,selectedId,
    guide:Object.freeze({active:guideActive,x:guideX,y:guideY}),actors:Object.freeze(actors.map(a=>Object.freeze({id:a.id,label:a.label,role:a.role,size:a.size,x:a.x,y:a.y,home:Object.freeze({x:a.homeX,y:a.homeY}),patch:Object.freeze({x:a.patchX,y:a.patchY}),behavior:Object.freeze({kind:a.kind,progress:a.progress}),leftClaw:a.leftClaw,rightClaw:a.rightClaw,gazeX:a.gazeX,gazeY:a.gazeY,crouch:a.crouch,feet:Object.freeze(a.feet.map(f=>Object.freeze({x:f.x,y:f.y,planted:f.planted,lift:f.lift})))})))});}
  function reset(){clock=cycle=selectedId=0;guideActive=false;guideX=guideY=0;syncCast(true);for(const a of actors){const x=a.x,y=a.y;pose(a,true);if(beat()==='arrive'){a.x=x;a.y=y;plant(a);}}}
  reset();
  return {
    snapshot,reset,cue,setBeat,
    select(id:number){validateId(id);selectedId=id;},
    guide(x:number,y:number){guideActive=true;guideX=x;guideY=y;},
    clearGuide(){guideActive=false;guideX=guideY=0;},
    nextBeat(poster=false){setBeat(beats()[(beatIndex()+1)%beats().length]!,poster);},
    configure(before:CrabConfig){
      const o=options(),sceneChange=before.scene!==o.scene,shape=before.scale!==o.scale||before.columns!==o.columns||before.rows!==o.rows||before.count!==o.count;
      const resized=new Set(actors.filter(a=>before.cast[a.id]?.size!==o.cast[a.id]?.size).map(a=>a.id));
      if(sceneChange){clock=cycle=0;guideActive=false;}
      else if(before.actDuration!==o.actDuration)clock=clock/before.actDuration*o.actDuration;
      if(before.seed!==o.seed){reset();return;}
      syncCast();
      for(const a of actors){
        if(shape||resized.has(a.id)){const r=crabRadius(o,a.size),ratio=o.columns*.56/o.rows;a.x=clamp(a.x,-.96+r*2.08,.96-r*2.08);a.y=clamp(a.y,-.83+r*ratio*1.5,.82-r*ratio);plant(a);}
        if(sceneChange){a.action=null;a.replyAt=null;pose(a,true);}
      }
    },
    step(){
      const o=options();if(o.director==='auto'){clock++;if(clock>=beats().length*o.actDuration){clock=0;cycle++;}}
      else clock=Math.min(clock+1,(beatIndex()+1)*o.actDuration-1);
      for(const a of actors){
        if(a.action&&tick()-a.action.start>=300)a.action=null;
        if(a.replyAt!==null&&tick()>=a.replyAt){a.replyAt=null;if(!a.action)a.action={kind:'signal',start:tick(),x:a.x,y:a.y,originX:a.x,originY:a.y};}
        pose(a);
      }
    }
  };
}

type CrabPoint = readonly [number,number];
interface CrabInk {
  point(x:number,y:number,tone:number,glyph?:string):void;
  ellipse(x:number,y:number,rx:number,ry:number,tone:number,glyph?:string):void;
  line(x:number,y:number,xx:number,yy:number,width:number,tone:number,glyph?:string):void;
  polygon(points:readonly CrabPoint[],tone:number,glyph?:string):void;
}

/** A species-local printable grid. All marks, including habitat, have real depth ownership. */
function crabRaster(o:CrabConfig){
  const cols=o.columns,rows=o.rows,ratio=cols*.56/rows,ramp='.,:;=+*#%@';
  const cells:CrabCell[]=Array.from({length:cols*rows},()=>({glyph:' ',tone:0}));
  const col=(x:number)=>(x+1)*.5*(cols-1),row=(y:number)=>(y+1)*.5*(rows-1);
  function put(c:number,r:number,tone:number,layer:NonNullable<CrabCell['layer']>,owner?:number,glyph?:string){
    c=Math.round(c);r=Math.round(r);if(c<0||c>=cols||r<0||r>=rows)return;
    if(layer==='cue'&&cells[r*cols+c]?.owner!==undefined)return;
    const t=clamp(Math.round(tone),0,9),value={glyph:glyph??ramp[t]!,tone:t,layer};
    cells[r*cols+c]=owner===undefined?value:{...value,owner};
  }
  function ink(layer:NonNullable<CrabCell['layer']>,owner?:number):CrabInk {
    const point=(x:number,y:number,t:number,g?:string)=>put(col(x),row(y),t,layer,owner,g);
    function ellipse(x:number,y:number,rx:number,ry:number,t:number,g?:string){
      const cx=col(x),cy=row(y),w=Math.max(.40,rx*.5*(cols-1)),h=Math.max(.40,ry*.5*(rows-1));
      for(let r=Math.max(0,Math.floor(cy-h));r<=Math.min(rows-1,Math.ceil(cy+h));r++)
        for(let c=Math.max(0,Math.floor(cx-w));c<=Math.min(cols-1,Math.ceil(cx+w));c++){
          const q=((c-cx)/w)**2+((r-cy)/h)**2;
          if(q<=1)put(c,r,t+(g?0:(1-q)*.65),layer,owner,g);
        }
      point(x,y,t,g);
    }
    function line(x:number,y:number,xx:number,yy:number,w:number,t:number,g?:string){
      const n=Math.max(1,Math.ceil(Math.max(Math.abs(col(xx)-col(x)),Math.abs(row(yy)-row(y)))*1.4));
      for(let i=0;i<=n;i++){
        const p=i/n,px=x+(xx-x)*p,py=y+(yy-y)*p;
        if(w>0)ellipse(px,py,w,w*ratio,t,g);else point(px,py,t,g);
      }
    }
    function polygon(points:readonly CrabPoint[],t:number,g?:string){
      const ps=points.map(([x,y])=>[col(x),row(y)] as const);
      const minY=Math.max(0,Math.floor(Math.min(...ps.map(p=>p[1])))),maxY=Math.min(rows-1,Math.ceil(Math.max(...ps.map(p=>p[1]))));
      const minX=Math.max(0,Math.floor(Math.min(...ps.map(p=>p[0])))),maxX=Math.min(cols-1,Math.ceil(Math.max(...ps.map(p=>p[0]))));
      for(let r=minY;r<=maxY;r++)for(let c=minX;c<=maxX;c++){
        let inside=false;
        for(let i=0,j=ps.length-1;i<ps.length;j=i++){
          const a=ps[i]!,b=ps[j]!;
          if((a[1]>r)!==(b[1]>r)&&c<(b[0]-a[0])*(r-a[1])/(b[1]-a[1])+a[0])inside=!inside;
        }
        if(inside)put(c,r,t,layer,owner,g);
      }
      // Thin tips remain connected even when their interior is smaller than a cell.
      for(let i=0;i<points.length;i++){const a=points[i]!,b=points[(i+1)%points.length]!;line(...a,...b,0,t,g);}
    }
    return {point,ellipse,line,polygon};
  }
  function text(x:number,y:number,label:string,tone:number){
    const c=clamp(Math.round(col(x))-Math.floor(label.length/2),0,cols-label.length),r=clamp(Math.round(row(y)),0,rows-1);
    for(let i=0;i<label.length;i++)put(c+i,r,tone,'label',undefined,label[i]!);
  }
  return {ink,text,frame(phase:CrabPhase):CrabFrame{
    const frozen=Object.freeze(cells.map(c=>Object.freeze(c)));
    const lines=Array.from({length:rows},(_,r)=>cells.slice(r*cols,(r+1)*cols).map(c=>c.glyph).join(''));
    return Object.freeze({columns:cols,rows,cells:frozen,text:lines.join('\n'),phase});
  }};
}

function localCrabInk(ink:CrabInk,x:number,y:number,r:number,sy:number,mirror=1):CrabInk {
  const map=([px,py]:CrabPoint):CrabPoint=>[x+px*r*mirror,y+py*sy];
  return {
    point(px,py,t,g){ink.point(...map([px,py]),t,g);},
    ellipse(px,py,rx,ry,t,g){ink.ellipse(...map([px,py]),rx*r,ry*sy,t,g);},
    line(px,py,qx,qy,w,t,g){ink.line(...map([px,py]),...map([qx,qy]),w*r,t,g);},
    polygon(points,t,g){ink.polygon(points.map(map),t,g);}
  };
}

/** Original shore-crab geometry: continuous grooved shield, chelae and eight legs. */
function paintShoreCrab(p:CrabInk,a:{left:number;right:number;crouch:number;gazeX:number;gazeY:number;feet:readonly CrabPoint[];planted:readonly boolean[];detail:boolean;seed:number}){
  const compress=1-a.crouch*.36,drop=a.crouch*.47;
  const by=(y:number)=>y*compress+drop;
  const bp=(x:number,y:number,t:number,g?:string)=>p.point(x,by(y),t,g);
  const bl=(x:number,y:number,xx:number,yy:number,w:number,t:number,g?:string)=>p.line(x,by(y),xx,by(yy),w,t,g);
  const poly=(points:readonly CrabPoint[],t:number,g?:string)=>p.polygon(points.map(([x,y])=>[x,by(y)] as const),t,g);

  // The legs sit below the shield. Joints bend toward the fixed toe, rather than
  // moving the toe with the body. Four separately readable fans on each side.
  for(let k=3;k>=0;k--)for(const side of [-1,1]){
    const index=(side<0?0:4)+k,toe=a.feet[index]!;
    const hx=side*(.68-k*.015),hy=by(-.14+k*.16);
    const ankle:CrabPoint=[toe[0]-side*.12,toe[1]-.065];
    const dx=ankle[0]-hx,dy=ankle[1]-hy;
    // Oblique projection fans front and rear knees apart instead of stacking
    // four nearly horizontal rails. Toes remain the director's exact contacts.
    const knee:CrabPoint=[hx+dx*.62+side*.045,hy+dy*.45+(k-1.3)*.115];
    p.line(hx,hy,...knee,.073,3);p.line(hx,hy,...knee,.033,6);
    p.line(...knee,...ankle,.043,4);p.line(...knee,...ankle,.016,7);
    p.ellipse(...knee,.063,.052,7,a.detail?'o':undefined);
    p.line(...ankle,...toe,.014,8);
    if(a.planted[index])p.point(...toe,6,'_');
  }

  // Dark ventral rim separates the continuous shield from its walking limbs.
  poly([[-.73,.17],[-.81,.36],[-.54,.55],[.52,.55],[.81,.33],[.72,.14]],3);
  bl(-.50,.47,.49,.47,.012,5,'=');

  // Chelipeds attach in front of the shield. One palm is moderately heavier;
  // asymmetry is shore-crab scale, not the single oversized claw of a fiddler.
  for(const side of [-1,1]){
    const lift=side<0?a.left:a.right,raised=Math.max(0,lift),mass=side<0?1.08:.94;
    const cx=side*(1.27-raised*.10),cy=-.61-lift*.56;
    const elbow:CrabPoint=[side*.99,by(-.26-lift*.22)],wrist:CrabPoint=[cx,by(cy+.16)];
    p.line(side*.50,by(-.21),...elbow,.115,3);p.line(side*.50,by(-.24),...elbow,.064,6);
    p.ellipse(...elbow,.105,.082,7);
    p.line(...elbow,...wrist,.092,4);p.line(...elbow,...wrist,.046,7);
    const angle=side*(.12+raised*.13),ca=Math.cos(angle),sa=Math.sin(angle);
    const m=([x,y]:CrabPoint):CrabPoint=>[cx+side*(x*ca-y*sa)*mass,by(cy+(x*sa+y*ca)*mass)];
    const shape=(ps:readonly CrabPoint[],t:number)=>p.polygon(ps.map(m),t);
    shape([[-.19,.17],[-.29,.03],[-.24,-.16],[-.11,-.25],[.14,-.21],[.27,-.04],[.22,.17],[.04,.25]],5);
    shape([[-.16,.02],[-.17,-.12],[-.04,-.20],[.12,-.14],[.16,.02],[.03,.12]],7);
    const gape=.07+raised*.24;
    // Fixed finger: an inward, hooked lower jaw. Mobile finger opens outside it.
    shape([[-.21,-.07],[-.29,-.31],[-.21,-.51],[-.10,-.55],[-.035,-.49],[-.15,-.42],[-.14,-.21]],6);
    shape([[.14,-.09],[.25+gape,-.25],[.23+gape,-.41],[.10+gape*.6,-.56],[.02+gape*.55,-.49],[.11+gape*.6,-.35],[.03,-.21]],7);
    p.line(...m([-.23,-.29]),...m([-.16,-.45]),.009,9);
    p.point(...m([.10+gape*.6,-.51]),9);
    if(a.detail){p.line(...m([-.10,.09]),...m([.11,.08]),0,4,':');p.point(...m([.04,-.05]),8,'.');}
  }

  // A broad, lightly toothed shield, not an oval filled with extra characters.
  const shell:readonly CrabPoint[]=[[-.54,.43],[-.80,.29],[-.91,.05],[-.87,-.18],[-.73,-.38],[-.48,-.51],[-.22,-.48],[0,-.53],[.22,-.48],[.48,-.51],[.73,-.38],[.87,-.18],[.91,.05],[.80,.29],[.54,.43]];
  poly(shell,5);
  poly([[-.67,.20],[-.77,-.08],[-.55,-.32],[-.23,-.37],[-.30,-.06],[-.25,.24],[-.49,.33]],6);
  poly([[.26,.28],[.30,-.07],[.24,-.36],[.56,-.31],[.76,-.06],[.66,.24],[.45,.34]],4);
  poly([[-.22,-.38],[0,-.45],[.20,-.37],[.25,-.10],[.12,.10],[-.11,.10],[-.26,-.11]],7);
  poly([[-.14,.13],[.12,.13],[.24,.30],[0,.38],[-.24,.28]],6);
  for(const side of [-1,1]){
    for(let k=0;k<4;k++){
      const y=-.32+k*.14,x=side*(.79+Math.sin(k/3*Math.PI)*.12);
      poly([[x,y-.05],[x+side*.09,y+.015],[x,y+.055]],side<0?7:5);
    }
    bl(side*.25,-.34,side*.30,-.13,.006,3,':');
    bl(side*.30,-.13,side*.17,.10,.006,3,':');
    bl(side*.17,.10,side*.43,.26,.006,3,':');
  }
  bl(-.56,-.40,-.28,-.45,.009,8);
  bl(-.81,-.10,-.76,.13,.010,7);
  bl(-.15,.10,.15,.10,.006,4,'_');
  if(a.detail){
    // Stable connected mottling; seed changes small islands, never frame noise.
    for(let k=0;k<12;k++){
      const x=Math.sin(k*2.41+a.seed*.17)*.63,y=Math.cos(k*1.87+a.seed*.07)*.23-.04;
      bp(x,y,k%3===0?7:4,k%3===0?':':'.');
    }
  }
  // Short, independently attending stalks emerge from the anterior shell.
  for(const side of [-1,1]){
    const ex=side*.38+a.gazeX*.055,ey=-.74+a.gazeY*.06+a.crouch*.12;
    bl(side*.30,-.43,ex,ey,.040,4);bl(side*.30,-.43,ex,ey,.012,8);
    bp(ex,ey,9,'O');
    bl(side*.12,-.49,side*.17,-.61,.006,6,'/');
  }
}

/** Pure legacy study: unchanged input/phase contract, using the same new anatomy. */
function renderCrab(o:CrabConfig,s:CrabState,phase:CrabPhase):CrabFrame {
  const raster=crabRaster(o),ratio=o.columns*.56/o.rows;
  const worldW=Math.max(6,3.7*ratio),r=2/worldW*o.scale,sy=r*ratio;
  const t=s.tick/60*o.speed,seedPhase=(o.seed%997)/997*TAU;
  const age=s.responseTick===null?0:s.tick-s.responseTick;
  const display=o.behavior==='guard'?{left:.93,right:.78,crouch:0}:s.responseTick===null?{left:0,right:.06,crouch:0}:clawDisplay(age*300/180);
  const x=(o.behavior==='curious'?s.targetX*.3:o.behavior==='scuttle'?Math.sin(t*.65+seedPhase)*o.sway:0)*2/worldW;
  const mirror=o.facing==='left'?1:-1;
  const feet:CrabPoint[]=Array.from({length:8},(_,k)=>{
    const side=k<4?-1:1,j=k%4,phase=o.behavior==='guard'?0:(t*1.35+(k%2)*.5+(k<4?0:.5))%1;
    const lift=phase>.68?Math.sin((phase-.68)/.32*Math.PI)*.15:0;
    return [side*(1.88-j*.11),-.13+j*.33-lift] as const;
  });
  const shadow=localCrabInk(raster.ink('sand'),x,.02,r,sy);
  shadow.ellipse(0,.38,1.37,.27,1,'.');
  paintShoreCrab(localCrabInk(raster.ink('crab',0),x,.02,r,sy,mirror),{
    ...display,gazeX:s.targetX,gazeY:s.targetY,feet,planted:feet.map(()=>true),detail:r*(o.columns-1)>16,seed:o.seed
  });
  return raster.frame(phase);
}

/** Tidal flat: distant wash, damp sediment, low ledges, then living anatomy. */
function renderTidepool(o:CrabConfig,s:CrabSceneState,phase:CrabPhase,tick:number):CrabFrame {
  const raster=crabRaster(o),ratio=o.columns*.56/o.rows,time=tick/60;
  const sand=raster.ink('sand'),water=raster.ink('water'),rock=raster.ink('rock');
  const waveY=-.81+s.tideLevel*.96;
  // Continuous broad contours, with restrained density. Nothing sparkles per frame.
  for(let c=0;c<o.columns;c++){
    const x=c/(o.columns-1)*2-1,edge=waveY+Math.sin(x*7-time*s.current*1.2)*.026;
    if(c%6!==0)water.point(x,edge,3,c%3===0?'-':'~');
    if(c%7<4)water.point(x,edge-.067,1,'_');
    if(c%11<5)water.point(x,edge+.042,1,'.');
    if(c%13<5)water.point(x,-.91+Math.sin(x*5+time*s.current*.42)*.02,1,'-');
  }
  for(let r=3;r<o.rows-1;r++)for(let c=2;c<o.columns-2;c++){
    const x=c/(o.columns-1)*2-1,y=r/(o.rows-1)*2-1;
    if(y<waveY+.06)continue;
    const hash=((c*73856093)^(r*19349663)^(o.seed*83492791))>>>0;
    if(hash%113===0)sand.point(x,y,1,hash%3===0?':':'.');
    if(r%7===0&&c%19<5&&Math.abs(x)>.45)sand.point(x,y+Math.sin(x*8)*.012,1,'_');
  }
  const shelter=(a:CrabResidentState,front:boolean)=>{
    const r=crabRadius(o,a.size),sy=r*ratio,p=localCrabInk(rock,a.home.x,a.home.y,r,sy);
    if(!front){
      p.polygon([[-1.55,.44],[-1.62,-.03],[-1.22,-.62],[-.51,-.86],[.35,-.78],[1.12,-.44],[1.47,.09],[1.35,.47]],2);
      p.polygon([[-1.44,-.05],[-1.12,-.51],[-.48,-.70],[.34,-.65],[.87,-.38],[.25,-.32],[-.52,-.45]],3);
      p.line(-1.16,-.52,-.55,-.73,0,4,'_');
      p.line(-.49,-.71,.31,-.64,0,3,'-');
      p.line(.11,-.63,-.12,-.31,0,1,':');
      p.ellipse(0,.05,1.13,.34,0,'.');
      p.line(-.83,-.12,.78,-.12,0,1,'_');
      // Two sparse fronds attach to the rock, never to the travelling crab.
      p.line(-1.25,-.20,-1.40,-.69,0,2,'/');p.line(-1.40,-.69,-1.18,-.82,0,2,'~');
      p.line(1.12,-.08,1.35,-.46,0,2,'/');
    }else{
      // A stationary front lip occludes the crab geometrically. Crouching lowers
      // shell/eyes behind it; the rock itself does not grow or follow the actor.
      p.polygon([[-1.57,.31],[-1.11,.12],[-.48,.16],[.12,.10],[.73,.18],[1.30,.12],[1.52,.37],[1.11,.66],[-.89,.68]],2);
      p.line(-1.10,.12,-.49,.16,0,4,'_');p.line(-.47,.16,.12,.10,0,3,'-');
      p.line(.73,.18,1.27,.12,0,4,'_');
      p.line(-.94,.45,-.58,.53,0,1,':');p.line(.29,.43,.68,.48,0,1,':');
    }
  };
  for(const a of s.actors)shelter(a,false);
  const ordered=[...s.actors].sort((a,b)=>a.y-b.y||a.id-b.id);
  // Painter depth includes the grounded body height. An open-flat crab stands
  // in front of its ledge; retreat and crouch carry it behind the fixed lip.
  // Sorting the rock itself (rather than conditionally drawing a mask over all
  // residents) also avoids erasing neighbouring animals in dense casts.
  const planes=s.actors.flatMap(a=>{
    const sy=crabRadius(o,a.size)*ratio;
    return [{a,cover:true,depth:a.home.y+sy*.28},{a,cover:false,depth:a.y+sy*(.30-a.crouch*.60)}];
  }).sort((a,b)=>a.depth-b.depth||Number(a.cover)-Number(b.cover)||a.a.id-b.a.id);
  for(const plane of planes){
    const a=plane.a;if(plane.cover){shelter(a,true);continue;}
    const r=crabRadius(o,a.size),sy=r*ratio,mirror=o.facing==='left'?1:-1;
    const ground=localCrabInk(sand,a.x,a.y,r,sy);
    ground.ellipse(.07,.43,1.42,.23,1,'.');
    const feet:CrabPoint[]=Array.from({length:8},(_,k)=>{
      const index=mirror<0?(k<4?k+4:k-4):k,f=a.feet[index]!;
      return [(f.x-a.x)/(r*mirror),(f.y-f.lift-a.y)/sy] as const;
    });
    paintShoreCrab(localCrabInk(raster.ink('crab',a.id),a.x,a.y,r,sy,mirror),{
      left:a.leftClaw,right:a.rightClaw,crouch:a.crouch,gazeX:a.gazeX,gazeY:a.gazeY,feet,
      planted:Array.from({length:8},(_,k)=>a.feet[mirror<0?(k<4?k+4:k-4):k]!.planted),detail:r*(o.columns-1)>16,seed:o.seed+a.id*23
    });
  }
  // Labels and guide never borrow a crab owner.
  if(o.labels)for(const a of ordered){
    const r=crabRadius(o,a.size),sy=r*ratio;
    const bottom=Math.max(a.y+sy*1.05,...a.feet.map(f=>f.y-f.lift));
    raster.text(a.x,bottom+4/(o.rows-1),`${a.id===s.selectedId?'[':' '}${a.id+1}${a.id===s.selectedId?']':' '} ${a.label.toUpperCase()}`,a.id===s.selectedId?8:5);
  }
  if(s.guide.active){const cue=raster.ink('cue');cue.point(s.guide.x,s.guide.y,7,'+');cue.point(s.guide.x-.025,s.guide.y,3,'.');cue.point(s.guide.x+.025,s.guide.y,3,'.');}
  return raster.frame(phase);
}


export interface CrabBrowserOptions extends CrabOptions { frameSource?:CrabFrameSource }
export interface CrabStatus { readonly paused:boolean; readonly reducedMotion:boolean; readonly hidden:boolean; readonly inViewport:boolean; readonly disposed:boolean; readonly phase:CrabPhase; readonly tick:number; readonly droppedSeconds:number; readonly scene:CrabScene;readonly beat:CrabBeat;readonly selectedId:number }
export interface CrabArtwork {
  readonly species:'crab'; readonly canvas:HTMLCanvasElement; readonly disposed:boolean;
  getOptions():CrabConfig; getStatus():CrabStatus; getFrame():CrabFrame;
  update(options:CrabOptions):void; play():void; pause():void; restart():void;
  pulse():void; guide(x:number,y:number):void; resize():void; dispose():void;
  getScene():CrabSceneState; select(id:number):void; cue(action:CrabAction,id?:number):void;
  setBeat(beat:CrabBeat):void; nextBeat():void; clearGuide():void;
  /** Event-driven UI updates, at most 5 Hz during playback; no second animation clock. */
  subscribe(listener:(status:CrabStatus)=>void):()=>void;
}
/** Browser-only mount, SSR-safe import. Reduced-motion policy stays authoritative. */
export function createCrabArtwork(canvas:HTMLCanvasElement,input:CrabBrowserOptions={}):CrabArtwork {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Options must be an object');
  const {frameSource,...raw}=input;
  const model=createCrabModel(raw),view=canvas?.ownerDocument?.defaultView,doc=canvas?.ownerDocument;
  if(!view||!doc)throw new TypeError('Canvas must belong to a browser document');
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas2D unavailable');
  const ctx:CanvasRenderingContext2D=context;
  const scheduler=frameSource??getBrowserScheduler(view);
  if(typeof scheduler.subscribe!=='function')throw new TypeError('frameSource requires subscribe');
  const media=view.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,requestedPaused=model.getOptions().paused,inViewport=true,width=0,height=0,droppedSeconds=0,last:number|null=null,accumulator=0;
  let unsubscribe:(()=>void)|null=null;
  let ro:ResizeObserver|undefined,io:IntersectionObserver|undefined;
  const listeners=new Set<(status:CrabStatus)=>void>();let notifiedTick=-Infinity;
  const reduced=()=>model.getOptions().reducedMotion==='system'&&media.matches;
  const blocked=()=>disposed||requestedPaused||reduced()||doc.hidden||!inViewport||width<=0||height<=0;
  const status=():CrabStatus=>{const s=model.getScene();return Object.freeze({paused:blocked(),reducedMotion:reduced(),hidden:doc.hidden,inViewport,disposed,phase:model.getPhase(),tick:model.getState().tick,droppedSeconds,scene:s.scene,beat:s.beat,selectedId:s.selectedId});};
  function notify(force=false){if(disposed||!listeners.size)return;const t=model.getState().tick;if(!force&&t-notifiedTick<12)return;notifiedTick=t;const s=status();for(const listener of [...listeners]){if(!listeners.has(listener))continue;try{listener(s);}catch(error){view!.setTimeout(()=>{throw error;},0);}}}
  function draw(){if(disposed||width<=0||height<=0)return;const frame=model.frame(),o=model.getOptions(),cw=width/frame.columns,ch=height/frame.rows;
    ctx.fillStyle='#09151b';ctx.fillRect(0,0,width,height);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.max(5,ch*.93)}px ui-monospace,SFMono-Regular,Consolas,monospace`;
    const palette=o.palette==='brass'?[232,185,105]:o.palette==='lagoon'?[119,218,204]:[227,154,180],cast=model.getScene().actors;
    for(let i=0;i<frame.cells.length;i++){const cell=frame.cells[i]!;if(cell.glyph===' ')continue;
      let color=palette,b=.25+cell.tone/12;
      if(cell.layer==='water'){color=[99,169,174];b=.28+cell.tone*.11;}
      else if(cell.layer==='sand'){color=[156,138,102];b=.30;}
      else if(cell.layer==='rock'){color=[106,145,143];b=.32+cell.tone*.09;}
      else if(cell.owner!==undefined&&o.palette==='brass'){const role=cast[cell.owner]?.role;color=role==='shy'?[132,207,185]:role==='territorial'?[235,147,113]:palette;}
      ctx.fillStyle=`rgb(${color.map(c=>Math.min(255,Math.round(c*b))).join(',')})`;ctx.fillText(cell.glyph,(i%frame.columns+.5)*cw,(Math.floor(i/frame.columns)+.5)*ch);
    }
  }
  function frame(now:number){if(disposed||blocked()){sync();return;}if(!Number.isFinite(now)){last=null;return;}if(last===null){last=now;return;}const dt=Math.max(0,(now-last)/1000);last=now;droppedSeconds+=Math.max(0,dt-.1);accumulator+=Math.min(.1,dt);const ticks=Math.min(6,Math.floor((accumulator+1e-10)*60));if(ticks){accumulator-=ticks/60;model.advanceTicks(ticks);draw();notify();}}
  function sync(){if(disposed)return;if(blocked()){unsubscribe?.();unsubscribe=null;last=null;accumulator=0;}else if(!unsubscribe){last=null;unsubscribe=scheduler.subscribe(frame);}draw();notify(true);}
  function resize(){if(disposed)return;const r=canvas.getBoundingClientRect();width=Math.max(0,Math.min(2048,Number.isFinite(r.width)?r.width:0));height=Math.max(0,Math.min(2048,Number.isFinite(r.height)?r.height:0));const dpr=Math.min(2,Math.max(1,view!.devicePixelRatio||1));canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);sync();}
  function motion(){sync();}function visibility(){sync();}
  function coords(e:PointerEvent):[number,number]|null{if(e.isPrimary===false)return null;const r=canvas.getBoundingClientRect();if(r.width<=0||r.height<=0)return null;const x=(e.clientX-r.left)/r.width*2-1,y=(e.clientY-r.top)/r.height*2-1;return Number.isFinite(x)&&Number.isFinite(y)?[clamp(x,-1,1),clamp(y,-1,1)]:null;}
  function pointer(e:PointerEvent){if(disposed)return;const p=coords(e);if(p){model.guide(...p);if(blocked())draw();}}
  function leave(){if(disposed)return;model.clearGuide();draw();notify(true);}
  function up(e:PointerEvent){if(e.pointerType==='touch'||e.pointerType==='pen')leave();}
  function greet(){if(disposed)return;model.greet(blocked());draw();notify(true);}
  function cue(action:CrabAction,id?:number){if(disposed)return;model.cue(action,id,blocked());draw();notify(true);}
  function down(e:PointerEvent){
    if(disposed)return;const p=coords(e);if(!p)return;const frame=model.frame();model.guide(...p);
    if(model.getOptions().scene==='study'){greet();return;}
    const c=Math.round((p[0]+1)*.5*(frame.columns-1)),r=Math.round((p[1]+1)*.5*(frame.rows-1));
    // Only a visible creature glyph owns a hit: sand, waves, labels and covering rocks do not.
    const cell=frame.cells[r*frame.columns+c],scene=model.getScene();
    if(cell?.layer==='crab'&&cell.owner!==undefined){const a=scene.actors[cell.owner]!;model.select(a.id);cue(a.role==='shy'?'shelter':a.role==='curious'?'forage':'signal',a.id);}
    else if(cell?.layer==='rock'){
      const nearest=[...scene.actors].sort((a,b)=>Math.hypot(a.home.x-p[0],a.home.y-p[1])-Math.hypot(b.home.x-p[0],b.home.y-p[1]))[0]!;
      model.select(nearest.id);cue('shelter',nearest.id);
    }
    else if(p[1]>-.81+scene.tideLevel*.96+.05){
      const cast=scene.actors.filter(a=>a.role==='curious'),eligible=cast.length?cast:scene.actors;
      const closest=[...eligible].sort((a,b)=>Math.hypot(a.x-p[0],a.y-p[1])-Math.hypot(b.x-p[0],b.y-p[1]))[0]!;
      model.select(closest.id);cue('forage',closest.id);
    }else{draw();notify(true);}
  }
  function setBeat(beat:CrabBeat){if(disposed)return;model.setBeat(beat,blocked());draw();notify(true);}
  function nextBeat(){if(disposed)return;model.nextBeat(blocked());draw();notify(true);}
  function keyboard(e:KeyboardEvent){
    if(disposed||e.altKey||e.ctrlKey||e.metaKey)return;
    const key=e.key?.toLowerCase(),scene=model.getScene();let handled=true;
    if(key===' '){requestedPaused=!requestedPaused;sync();}
    else if(key==='f')cue('forage');else if(key==='s')cue('signal');else if(key==='h')cue('shelter');
    else if(key==='n')nextBeat();else if(key==='escape')leave();
    else if(key&&/^[1-5]$/.test(key)){const id=Number(key)-1;if(id<scene.actors.length){model.select(id);draw();notify(true);}}
    else if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
      const x=scene.guide.x+(key==='arrowleft'?-.12:key==='arrowright'?.12:0),y=scene.guide.y+(key==='arrowup'?-.12:key==='arrowdown'?.12:0);
      model.guide(x,y);draw();notify(true);
    }else handled=false;
    if(handled)e.preventDefault();
  }
  function dispose(){if(disposed)return;disposed=true;unsubscribe?.();unsubscribe=null;listeners.clear();ro?.disconnect();io?.disconnect();media.removeEventListener('change',motion);doc!.removeEventListener('visibilitychange',visibility);view!.removeEventListener('resize',resize);canvas.removeEventListener('pointermove',pointer);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointercancel',leave);canvas.removeEventListener('lostpointercapture',leave);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('keydown',keyboard);}
  try{media.addEventListener('change',motion);doc.addEventListener('visibilitychange',visibility);view.addEventListener('resize',resize);canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointercancel',leave);canvas.addEventListener('lostpointercapture',leave);canvas.addEventListener('pointerup',up);canvas.addEventListener('keydown',keyboard);
    const host=view as Window & {ResizeObserver?:typeof ResizeObserver;IntersectionObserver?:typeof IntersectionObserver};
    if(host.ResizeObserver){ro=new host.ResizeObserver(resize);ro.observe(canvas);}if(host.IntersectionObserver){inViewport=false;io=new host.IntersectionObserver(entries=>{if(disposed)return;inViewport=entries.some(e=>e.isIntersecting);sync();});io.observe(canvas);}resize();
  }catch(error){dispose();throw error;}
  return Object.freeze({species:'crab',canvas,get disposed(){return disposed;},getOptions:()=>Object.freeze({...model.getOptions(),paused:requestedPaused}),getStatus:status,getFrame:()=>model.frame(),
    update(patch:CrabOptions){if(disposed)return;model.configure(patch);if(patch.paused!==undefined)requestedPaused=patch.paused;if(blocked()&&(patch.scene!==undefined||patch.formation!==undefined))model.setBeat(model.getScene().beat,true);sync();},play(){if(disposed)return;requestedPaused=false;sync();},pause(){if(disposed)return;requestedPaused=true;sync();},restart(){if(disposed)return;model.reset();last=null;accumulator=0;sync();},pulse:greet,guide(x:number,y:number){if(disposed)return;model.guide(x,y);draw();notify(true);},resize,dispose,
    getScene:model.getScene,select(id:number){if(disposed)return;model.select(id);draw();notify(true);},cue,setBeat,nextBeat,clearGuide:leave,
    subscribe(listener:(status:CrabStatus)=>void){if(typeof listener!=='function')throw new TypeError('Subscriber must be a function');if(disposed)return ()=>{};const entry=(s:CrabStatus)=>listener(s);listeners.add(entry);try{entry(status());}catch(error){listeners.delete(entry);throw error;}return ()=>{listeners.delete(entry);};}
  });
}
