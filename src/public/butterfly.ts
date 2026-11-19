import { getBrowserScheduler } from '../core/scheduler.js';
import {createGardenDirector, resolveButterflyDirectorOptions, BUTTERFLY_DIRECTOR_DEFAULTS, BUTTERFLY_SCENES} from './butterfly/director.js';
import type {ButterflyDirectorOptions, ButterflyDirectorConfig, ButterflyGardenState, ButterflyCue, ButterflySceneDescription} from './butterfly/director.js';
import {renderButterflyGarden, renderButterflySpecimen} from './butterfly/render-garden.js';
export type {ButterflyScene, ButterflyPath, ButterflyRole, ButterflyPointerMode, ButterflyCue, ButterflyActivity,
  ButterflyDirectorOptions, ButterflyDirectorConfig, ButterflyGardenMember, ButterflyGardenState,
  ButterflyFlower, ButterflySceneDescription} from './butterfly/director.js';
/** Borrowed scheduler subscription; controller never owns or disposes it. */
export interface ButterflyFrameSource { subscribe(callback:(timestamp:number)=>void):()=>void }

export interface ButterflyOptions {
  columns?: number; rows?: number; seed?: number; speed?: number; scale?: number;
  sway?: number; facing?: 'left' | 'right'; behavior?: 'hover' | 'curious' | 'perch';
  palette?: 'brass' | 'lagoon' | 'rose'; paused?: boolean;
  reducedMotion?: 'system' | 'ignore';
  director?:ButterflyDirectorOptions;
}
export type ButterflyConfig = Readonly<Required<Omit<ButterflyOptions,'director'>> & {director:ButterflyDirectorConfig}>;
export const BUTTERFLY_DEFAULTS: ButterflyConfig = Object.freeze({ columns:120, rows:50, seed:7,
  speed:1, scale:1, sway:.18, facing:'left', behavior:'hover', palette:'brass', paused:false, reducedMotion:'system', director:BUTTERFLY_DIRECTOR_DEFAULTS });
const ranges = { columns:[80,180], rows:[32,90], seed:[0,2147483647], speed:[.25,2], scale:[.6,1.3], sway:[0,.4] } as const;
function resolve(patch: ButterflyOptions, base: ButterflyConfig): ButterflyConfig {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Butterfly options must be an object');
  for(const key of Object.keys(patch)) if(!Object.hasOwn(BUTTERFLY_DEFAULTS,key)) throw new TypeError(`Unknown butterfly option ${key}`);
  const candidate = {...base};
  for(const key of Object.keys(BUTTERFLY_DEFAULTS) as (keyof ButterflyOptions)[]) {
    const value=patch[key]; if(key!=='director'&&value!==undefined) Object.defineProperty(candidate,key,{value,enumerable:true,writable:true,configurable:true});
  }
  for(const [key,[lo,hi]] of Object.entries(ranges)) {
    const value=candidate[key as keyof typeof ranges];
    if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi||(['columns','rows','seed'].includes(key)&&!Number.isInteger(value))) throw new RangeError(`Invalid ${key}`);
  }
  if(!['left','right'].includes(candidate.facing)||!['hover','curious','perch'].includes(candidate.behavior)||!['brass','lagoon','rose'].includes(candidate.palette)||!['system','ignore'].includes(candidate.reducedMotion)||typeof candidate.paused!=='boolean') throw new TypeError('Invalid butterfly setting');
  candidate.director=resolveButterflyDirectorOptions(patch.director===undefined?{}:patch.director,base.director);
  return Object.freeze(candidate);
}
/** The base-taking merge helper is private; all public configuration is validated. */
export function normalizeButterflyOptions(patch: ButterflyOptions = {}): ButterflyConfig { return resolve(patch,BUTTERFLY_DEFAULTS); }
export interface ButterflyState { readonly tick:number; readonly responseTick:number|null; readonly targetX:number; readonly targetY:number }
export type ButterflyPhase = 'idle'|'approach'|'display'|'settle';
export interface ButterflyCell { readonly glyph:string; readonly tone:number; readonly ink?:number }
export interface ButterflyFrame { readonly columns:number; readonly rows:number; readonly cells:readonly ButterflyCell[]; readonly text:string; readonly phase:ButterflyPhase }
export interface ButterflyModel {
  getOptions():ButterflyConfig; getState():ButterflyState; getPhase():ButterflyPhase;
  configure(patch:ButterflyOptions):void; advanceTicks(ticks:number):void; guide(x:number,y:number):void; greet(poster?:boolean):void; reset():void;
  frame():ButterflyFrame; getGarden():ButterflyGardenState; getScenes():readonly ButterflySceneDescription[];
  cue(action:ButterflyCue,poster?:boolean):void; nextAct(poster?:boolean):void; release():void;
}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
/** Pure 60Hz model. The specimen defaults and its legacy response phases are unchanged. */
export function createButterflyModel(input:ButterflyOptions={}):ButterflyModel {return makeModel(input).model;}
function makeModel(input:ButterflyOptions){
  let options=normalizeButterflyOptions(input),tick=0,responseTick:number|null=null,targetX=0,targetY=0;
  const garden=createGardenDirector(options.director,options.seed,options);
  const state=():ButterflyState=>Object.freeze({tick,responseTick,targetX,targetY});
  const phase=():ButterflyPhase=>responseTick===null?'idle':tick-responseTick<45?'approach':tick-responseTick<110?'display':'settle';
  const render=(still=false):ButterflyFrame=>options.director.scene==='specimen'?renderButterflySpecimen(options,state(),phase(),still):renderButterflyGarden(options,garden.getState(),phase(),still);
  const model:ButterflyModel=Object.freeze({getOptions:()=>options,getState:state,getPhase:phase,getGarden:()=>garden.getState(),getScenes:()=>BUTTERFLY_SCENES,
    configure(patch:ButterflyOptions){const next=resolve(patch,options);garden.configure(next.director,next.seed,next);options=next;},
    advanceTicks(ticks:number){
      if(!Number.isInteger(ticks)||ticks<0||ticks>600||!Number.isSafeInteger(tick+ticks))throw new RangeError('Ticks must be an integer0..600');
      for(let i=0;i<ticks;i++)garden.step(options.speed);
      tick+=ticks;if(responseTick!==null&&tick-responseTick>=180)responseTick=null;
    },
    guide(x:number,y:number){
      if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Guide requires finite normalized coordinates');
      targetX=clamp(x,-1,1);targetY=clamp(y,-1,1);garden.guide(targetX,targetY);
    },
    greet(poster=false){if(responseTick===null){responseTick=tick-(poster?70:0);if(options.director.scene!=='specimen')garden.cue('gather',poster);}},
    cue(action:ButterflyCue,poster=false){garden.cue(action,poster);},nextAct(poster=false){garden.nextAct(poster);},
    release(){targetX=targetY=0;garden.release();},
    reset(){tick=0;responseTick=null;targetX=targetY=0;garden.reset();},
    frame(){return render(options.paused);}
  });
  return {model,render,still:()=>garden.still(),unhover:()=>{targetX=targetY=0;garden.release(false);}};
}
export interface ButterflyBrowserOptions extends ButterflyOptions { frameSource?:ButterflyFrameSource }
export interface ButterflyStatus { readonly paused:boolean; readonly reducedMotion:boolean; readonly hidden:boolean; readonly inViewport:boolean; readonly disposed:boolean; readonly phase:ButterflyPhase; readonly tick:number; readonly droppedSeconds:number }
export interface ButterflyArtwork {
  readonly species:'butterfly'; readonly canvas:HTMLCanvasElement; readonly disposed:boolean;
  getOptions():ButterflyConfig; getStatus():ButterflyStatus; getFrame():ButterflyFrame;
  update(options:ButterflyOptions):void; play():void; pause():void; restart():void;
  pulse():void; guide(x:number,y:number):void; resize():void; dispose():void;
  getGarden():ButterflyGardenState; getScenes():readonly ButterflySceneDescription[]; cue(action:ButterflyCue):void; nextAct():void; release():void;
}
/** Browser-only mount, SSR-safe import. Reduced-motion policy stays authoritative. */
export function createButterflyArtwork(canvas:HTMLCanvasElement,input:ButterflyBrowserOptions={}):ButterflyArtwork {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Options must be an object');
  const {frameSource,...raw}=input;
  const {model,render,still,unhover}=makeModel(raw),view=canvas?.ownerDocument?.defaultView,doc=canvas?.ownerDocument;
  if(!view||!doc)throw new TypeError('Canvas must belong to a browser document');
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas2D unavailable');
  const ctx:CanvasRenderingContext2D=context;
  if(frameSource!==undefined&&(!frameSource||typeof frameSource.subscribe!=='function'))throw new TypeError('frameSource must expose subscribe');
  const scheduler=frameSource??getBrowserScheduler(view);
  const media=view.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,requestedPaused=model.getOptions().paused,inViewport=true,width=0,height=0,droppedSeconds=0,last:number|null=null,accumulator=0;
  let unsubscribe:(()=>void)|null=null;
  let pendingGuide:readonly [number,number]|null=null;
  let ro:ResizeObserver|undefined,io:IntersectionObserver|undefined;
  const reduced=()=>model.getOptions().reducedMotion==='system'&&media.matches;
  const blocked=()=>disposed||requestedPaused||reduced()||doc.hidden||!inViewport||width<=0||height<=0;
  const status=():ButterflyStatus=>Object.freeze({paused:blocked(),reducedMotion:reduced(),hidden:doc.hidden,inViewport,disposed,phase:model.getPhase(),tick:model.getState().tick,droppedSeconds});
  function draw(){
    if(disposed||width<=0||height<=0)return;
    const frame=render(blocked()),o=model.getOptions();
    // Preserve the declared logical .56 cell aspect on every host size; do not stretch anatomy.
    const ch=Math.min(height/frame.rows,width/(frame.columns*.56)),cw=ch*.56;
    const ox=(width-frame.columns*cw)/2,oy=(height-frame.rows*ch)/2;
    ctx.fillStyle=o.director.scene==='specimen'?'#09151b':o.director.scene==='roost'?'#111c25':'#101e1c';ctx.fillRect(0,0,width,height);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.max(1,ch*.96)}px ui-monospace,SFMono-Regular,Consolas,monospace`;
    const main=o.palette==='brass'?[239,156,72]:o.palette==='lagoon'?[139,214,187]:[235,145,170];
    const inks=[main,main,[227,164,84],[243,177,97],[220,144,72],[231,174,95],[235,154,79],
      [94,136,102],[220,157,151],[112,157,143],[139,117,79],[252,229,180],[115,142,123]];
    const tinted=inks.map((rgb,index)=>index>=2&&index<=6?rgb.map((value,c)=>Math.round(value*.28+main[c]!*.72)):rgb);
    const colors=tinted.map(rgb=>Array.from({length:10},(_,tone)=>`rgb(${rgb.map(c=>Math.round(c*(.20+tone/11.25))).join(',')})`));
    let prior='';
    for(let i=0;i<frame.cells.length;i++){
      const cell=frame.cells[i]!;if(cell.glyph===' ')continue;
      const color=colors[cell.ink??0]?.[cell.tone]??colors[0]![cell.tone]!;
      if(prior!==color){ctx.fillStyle=color;prior=color;}
      ctx.fillText(cell.glyph,ox+(i%frame.columns+.5)*cw,oy+(Math.floor(i/frame.columns)+.5)*ch);
    }
  }
  function frame(now:number){
    if(disposed||blocked()){sync();return;}
    if(pendingGuide){model.guide(...pendingGuide);pendingGuide=null;}
    if(last===null){last=now;return;}
    const dt=Math.max(0,(now-last)/1000);last=now;droppedSeconds+=Math.max(0,dt-.1);
    accumulator+=Math.min(.1,dt);const ticks=Math.min(6,Math.floor((accumulator+1e-10)*60));
    if(ticks){accumulator-=ticks/60;model.advanceTicks(ticks);draw();}
  }
  function sync(){if(disposed)return;if(blocked()){unsubscribe?.();unsubscribe=null;last=null;accumulator=0;pendingGuide=null;}else if(!unsubscribe){last=null;unsubscribe=scheduler.subscribe(frame);}draw();}
  function resize(){if(disposed)return;const r=canvas.getBoundingClientRect();width=Math.max(0,Math.min(2048,Number.isFinite(r.width)?r.width:0));height=Math.max(0,Math.min(2048,Number.isFinite(r.height)?r.height:0));const dpr=Math.min(2,Math.max(1,view!.devicePixelRatio||1));canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);sync();}
  function motion(){pendingGuide=null;model.release();if(reduced())still();sync();}function visibility(){pendingGuide=null;sync();}
  function coordinates(e:PointerEvent):readonly [number,number]|null {
    const r=canvas.getBoundingClientRect();if(r.width<=0||r.height<=0)return null;
    // Match the letterboxed grid, including a canvas scaled by layout or zoom.
    const o=model.getOptions(),ch=Math.min(r.height/o.rows,r.width/(o.columns*.56));
    const gw=o.columns*ch*.56,gh=o.rows*ch;
    const x=(e.clientX-r.left-(r.width-gw)/2)/gw*2-1,y=(e.clientY-r.top-(r.height-gh)/2)/gh*2-1;
    return Number.isFinite(x)&&Number.isFinite(y)?[clamp(x,-1,1),clamp(y,-1,1)]:null;
  }
  function pointer(e:PointerEvent){
    if(disposed||blocked())return;const p=coordinates(e);if(p)pendingGuide=p;
  }
  function leave(){if(disposed)return;pendingGuide=null;model.release();if(blocked())still();draw();}
  function exitPointer(){if(disposed)return;pendingGuide=null;unhover();draw();}
  function releaseTouch(e:PointerEvent){if(e.pointerType==='touch')exitPointer();}
  function greet(){if(disposed)return;model.greet(blocked());draw();}
  function press(e:PointerEvent){
    if(disposed)return;pendingGuide=null;const p=coordinates(e);if(!p)return;
    model.guide(...p);
    if(model.getOptions().director.scene==='specimen')model.greet(blocked());
    else if(model.getOptions().director.pointerMode==='breeze')model.cue('breeze',blocked());
    else if(model.getOptions().director.pointerMode==='attract')model.cue('gather',blocked());
    draw();
  }
  function dispose(){if(disposed)return;disposed=true;unsubscribe?.();unsubscribe=null;ro?.disconnect();io?.disconnect();media.removeEventListener('change',motion);doc!.removeEventListener('visibilitychange',visibility);view!.removeEventListener('resize',resize);canvas.removeEventListener('pointermove',pointer);canvas.removeEventListener('pointerdown',press);canvas.removeEventListener('pointerleave',exitPointer);canvas.removeEventListener('pointerup',releaseTouch);canvas.removeEventListener('pointercancel',leave);canvas.removeEventListener('lostpointercapture',exitPointer);pendingGuide=null;}
  try{media.addEventListener('change',motion);doc.addEventListener('visibilitychange',visibility);view.addEventListener('resize',resize);canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',press);canvas.addEventListener('pointerleave',exitPointer);canvas.addEventListener('pointerup',releaseTouch);canvas.addEventListener('pointercancel',leave);canvas.addEventListener('lostpointercapture',exitPointer);
    const host=view as Window & {ResizeObserver?:typeof ResizeObserver;IntersectionObserver?:typeof IntersectionObserver};
    if(host.ResizeObserver){ro=new host.ResizeObserver(resize);ro.observe(canvas);}if(reduced())still();if(host.IntersectionObserver){inViewport=false;io=new host.IntersectionObserver(entries=>{if(disposed)return;inViewport=entries.some(e=>e.isIntersecting);sync();});io.observe(canvas);}resize();
  }catch(error){dispose();throw error;}
  return Object.freeze({species:'butterfly',canvas,get disposed(){return disposed;},getOptions:()=>Object.freeze({...model.getOptions(),paused:requestedPaused}),getStatus:status,getFrame:()=>render(blocked()),getGarden:()=>model.getGarden(),getScenes:()=>model.getScenes(),
    update(patch:ButterflyOptions){if(disposed)return;model.configure(patch);if(patch.paused!==undefined)requestedPaused=patch.paused;
      if(blocked()&&patch.director&&['scene','count','roles','path','spread','breeze'].some(key=>Object.hasOwn(patch.director!,key)))still();sync();},play(){if(disposed)return;requestedPaused=false;sync();},pause(){if(disposed)return;requestedPaused=true;sync();},restart(){if(disposed)return;model.reset();pendingGuide=null;last=null;accumulator=0;sync();},pulse:greet,guide(x:number,y:number){if(disposed)return;model.guide(x,y);if(blocked()&&model.getOptions().director.pointerMode!=='off')still();draw();},
    cue(action:ButterflyCue){if(disposed)return;model.cue(action,blocked());draw();},
    nextAct(){if(disposed)return;model.nextAct(blocked());draw();},release:leave,resize,dispose});
}
