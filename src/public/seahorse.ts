import { getBrowserScheduler } from '../core/scheduler.js';
/** Borrowed scheduler subscription; controller never owns or disposes it. */
export interface SeahorseFrameSource { subscribe(callback:(timestamp:number)=>void):()=>void }

export interface SeahorseOptions {
  columns?: number; rows?: number; seed?: number; speed?: number; scale?: number;
  sway?: number; facing?: 'left' | 'right'; behavior?: 'hover' | 'curious' | 'holdfast';
  palette?: 'brass' | 'lagoon' | 'rose'; paused?: boolean;
  reducedMotion?: 'system' | 'ignore';
}
export type SeahorseConfig = Readonly<Required<SeahorseOptions>>;
export const SEAHORSE_DEFAULTS: SeahorseConfig = Object.freeze({ columns:100, rows:60, seed:7,
  speed:1, scale:1, sway:.18, facing:'left', behavior:'hover', palette:'brass', paused:false, reducedMotion:'system' });
const ranges = { columns:[64,160], rows:[36,100], seed:[0,2147483647], speed:[.25,2], scale:[.6,1.3], sway:[0,.4] } as const;
function resolve(patch: SeahorseOptions, base: SeahorseConfig): SeahorseConfig {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Seahorse options must be an object');
  for(const key of Object.keys(patch)) if(!Object.hasOwn(SEAHORSE_DEFAULTS,key)) throw new TypeError(`Unknown seahorse option ${key}`);
  const candidate = {...base};
  for(const key of Object.keys(SEAHORSE_DEFAULTS) as (keyof SeahorseOptions)[]) {
    const value=patch[key]; if(value!==undefined) Object.defineProperty(candidate,key,{value,enumerable:true,writable:true,configurable:true});
  }
  for(const [key,[lo,hi]] of Object.entries(ranges)) {
    const value=candidate[key as keyof typeof ranges];
    if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi||(['columns','rows','seed'].includes(key)&&!Number.isInteger(value))) throw new RangeError(`Invalid ${key}`);
  }
  if(!['left','right'].includes(candidate.facing)||!['hover','curious','holdfast'].includes(candidate.behavior)||!['brass','lagoon','rose'].includes(candidate.palette)||!['system','ignore'].includes(candidate.reducedMotion)||typeof candidate.paused!=='boolean') throw new TypeError('Invalid seahorse setting');
  return Object.freeze(candidate);
}
/** The base-taking merge helper is private; all public configuration is validated. */
export function normalizeSeahorseOptions(patch: SeahorseOptions = {}): SeahorseConfig { return resolve(patch,SEAHORSE_DEFAULTS); }
export interface SeahorseState { readonly tick:number; readonly responseTick:number|null; readonly targetX:number; readonly targetY:number }
export type SeahorsePhase = 'idle'|'inspect'|'curl'|'settle';
export interface SeahorseCell { readonly glyph:string; readonly tone:number }
export interface SeahorseFrame { readonly columns:number; readonly rows:number; readonly cells:readonly SeahorseCell[]; readonly text:string; readonly phase:SeahorsePhase }
export interface SeahorseModel {
  getOptions():SeahorseConfig; getState():SeahorseState; getPhase():SeahorsePhase;
  configure(patch:SeahorseOptions):void; advanceTicks(ticks:number):void; guide(x:number,y:number):void; greet(poster?:boolean):void; reset():void;
  frame():SeahorseFrame;
}
const TAU=Math.PI*2, clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function createSeahorseModel(input:SeahorseOptions={}):SeahorseModel {
  let options=normalizeSeahorseOptions(input),tick=0,responseTick:number|null=null,targetX=0,targetY=0;
  const state=():SeahorseState=>Object.freeze({tick,responseTick,targetX,targetY});
  const phase=():SeahorsePhase=>responseTick===null?'idle':tick-responseTick<45?'inspect':tick-responseTick<110?'curl':'settle';
  return Object.freeze({getOptions:()=>options,getState:state,getPhase:phase,
    configure(patch:SeahorseOptions){options=resolve(patch,options);},
    advanceTicks(ticks:number){if(!Number.isInteger(ticks)||ticks<0||ticks>600)throw new RangeError('Ticks must be an integer0..600');tick+=ticks;if(responseTick!==null&&tick-responseTick>=180)responseTick=null;},
    guide(x:number,y:number){if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Guide requires finite normalized coordinates');targetX=clamp(x,-1,1);targetY=clamp(y,-1,1);},
    greet(poster=false){if(responseTick===null)responseTick=tick-(poster?70:0);},reset(){tick=0;responseTick=null;targetX=targetY=0;},
    frame(){return renderSeahorse(options,state(),phase());}
  });
}
/** Pure logical-cell rendering; no DOM, font, random or wall-clock dependency. */
function renderSeahorse(o:SeahorseConfig,s:SeahorseState,phase:SeahorsePhase):SeahorseFrame {
  const cols=o.columns,rows=o.rows,worldH=5.05,worldW=worldH*cols*.56/rows;
  const glyphs=new Array<string>(cols*rows).fill(' '), tones=new Uint8Array(cols*rows);
  const t=s.tick/60*o.speed,seedPhase=(o.seed%997)/997*TAU;
  const response=s.responseTick===null?0:Math.sin(Math.PI*clamp((s.tick-s.responseTick)/180,0,1));
  const sway=o.behavior==='holdfast'?o.sway*.15:o.sway;
  const lean=.045*Math.sin(t*.7+seedPhase)+(o.behavior==='curious'?.08*s.targetX:0)+response*.065;
  const dx=sway*Math.sin(t*.45+seedPhase),dy=sway*.6*Math.sin(t*.68+seedPhase)+(o.behavior==='curious'?s.targetY*.1:0);
  const co=Math.cos(lean),si=Math.sin(lean),mirror=o.facing==='left'?1:-1;
  const chars='.,:;+=*#%@';
  function point(x:number,y:number,tone:number,glyph?:string,animal=true) {
    if(animal){const xx=(x*co-y*si)*o.scale*mirror+dx; y=(x*si+y*co)*o.scale+dy; x=xx;}
    const c=Math.round((x/worldW+.5)*(cols-1)),r=Math.round((y/worldH+.5)*(rows-1));
    if(c<0||c>=cols||r<0||r>=rows)return;
    const i=r*cols+c;glyphs[i]=glyph??chars[clamp(Math.round(tone),0,chars.length-1)]!;tones[i]=clamp(Math.round(tone),1,9);
  }
  function disk(x:number,y:number,r:number,tone:number,glyph?:string){
    const step=worldH/rows*.35;
    for(let yy=-r;yy<=r;yy+=step)for(let xx=-r;xx<=r;xx+=step)if(xx*xx+yy*yy<=r*r)point(x+xx,y+yy,tone,glyph);
    point(x,y,tone,glyph);
  }
  function line(x1:number,y1:number,x2:number,y2:number,r:number,tone:number,glyph?:string){
    const n=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/(.6*worldH/rows)));
    for(let k=0;k<=n;k++){const a=k/n;disk(x1+(x2-x1)*a,y1+(y2-y1)*a,r,tone,glyph);}
  }
  function ellipse(cx:number,cy:number,rx:number,ry:number,tone:number,rings=false){
    const step=worldH/rows*.35;
    for(let y=-ry;y<=ry;y+=step)for(let x=-rx;x<=rx;x+=step){const q=x*x/(rx*rx)+y*y/(ry*ry);if(q>1)continue;const lighting=tone+(1-q)*2-x/rx*.6;const band=rings&&Math.floor((y+ry)*25)%4===0;point(cx+x,cy+y,band?lighting+1.7:lighting,band?'=':undefined);}
  }
  // A quiet holdfast frond is an environmental attachment, never a replacement tail.
  if(o.behavior==='holdfast')for(let k=0;k<60;k++){const y=.9+k*.026,x=.24+.08*Math.sin(k*.08);point(x,y,2,'|',false);if(k%10===0)for(let j=1;j<7;j++)point(x+j*.05,y-j*.02,2,'/',false);}
  // Dorsal fin sits behind the bony trunk. Its independently phased rays flutter.
  for(let k=0;k<14;k++){const a=k/13,flutter=.05*Math.sin(t*15+k*.55);line(.37,-.60+a*.72,.80+flutter+.12*Math.sin(a*Math.PI),-.66+a*.85,.014,3,':');}
  // Tapering curved tail with a visible interior and a rounded spiral end.
  const curl=o.behavior==='holdfast'?1:response*.75;
  const tail: [number,number][]=[];
  for(let k=0;k<=30;k++){const a=k/30;tail.push([.20+.10*Math.sin(a*Math.PI),.65+a*.65]);}
  const radius=.43-curl*.10;
  for(let k=0;k<=100;k++){const a=k/100,angle=-.15+a*Math.PI*2.05,r=radius*(1-a*.68);tail.push([.27-radius+r*Math.cos(angle),1.34+r*Math.sin(angle)]);}
  for(let k=1;k<tail.length;k++){const a=tail[k-1]!,b=tail[k]!,f=k/tail.length;line(a[0],a[1],b[0],b[1],.12*(1-f)+.025,5.5+f*1.5);}
  ellipse(.17,-.10,.37,.91,5.4,true);
  // Slender S-shaped neck rises from the breast into the head.
  const neck:[number,number][]=[[.10,-.70],[-.12,-.91],[-.29,-1.10],[-.23,-1.30],[-.07,-1.42]];
  for(let k=1;k<neck.length;k++){const a=neck[k-1]!,b=neck[k]!;line(a[0],a[1],b[0],b[1],.15,6.2);}
  ellipse(-.24,-1.41,.30,.23,6.5);
  line(-.44,-1.40,-.90,-1.29,.085,6.8);line(-.90,-1.34,-.91,-1.24,.02,9,'|');
  // Coronet and small back spines establish a seahorse rather than a generic fish.
  for(let k=0;k<4;k++){const x=-.35+k*.105;line(x,-1.58,x+.025,-1.76+(k%2)*.07,.028,7);}
  for(let k=0;k<9;k++){const y=-.67+k*.15;line(.39,y,.48,y+.05,.024,6);}
  // Pectoral fin below the head has a faster rhythm than the dorsal fan.
  for(let k=0;k<7;k++)line(-.13,-1.22,.12+.045*Math.sin(t*19+k),-1.20+k*.045,.013,3,'.');
  point(-.36,-1.46,9,'@');point(-.35,-1.48,9,'o');
  const cells=Object.freeze(glyphs.map((glyph,i)=>Object.freeze({glyph,tone:tones[i]!})));
  let text='';for(let r=0;r<rows;r++)text+=glyphs.slice(r*cols,(r+1)*cols).join('')+(r===rows-1?'':'\n');
  return Object.freeze({columns:cols,rows,cells,text,phase});
}
export interface SeahorseBrowserOptions extends SeahorseOptions { frameSource?:SeahorseFrameSource }
export interface SeahorseStatus { readonly paused:boolean; readonly reducedMotion:boolean; readonly hidden:boolean; readonly inViewport:boolean; readonly disposed:boolean; readonly phase:SeahorsePhase; readonly tick:number; readonly droppedSeconds:number }
export interface SeahorseArtwork {
  readonly species:'seahorse'; readonly canvas:HTMLCanvasElement; readonly disposed:boolean;
  getOptions():SeahorseConfig; getStatus():SeahorseStatus; getFrame():SeahorseFrame;
  update(options:SeahorseOptions):void; play():void; pause():void; restart():void;
  pulse():void; guide(x:number,y:number):void; resize():void; dispose():void;
}
/** Browser-only mount, SSR-safe import. Reduced-motion policy stays authoritative. */
export function createSeahorseArtwork(canvas:HTMLCanvasElement,input:SeahorseBrowserOptions={}):SeahorseArtwork {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Options must be an object');
  const {frameSource,...raw}=input;
  const model=createSeahorseModel(raw),view=canvas?.ownerDocument?.defaultView,doc=canvas?.ownerDocument;
  if(!view||!doc)throw new TypeError('Canvas must belong to a browser document');
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas2D unavailable');
  const ctx:CanvasRenderingContext2D=context;
  const scheduler=frameSource??getBrowserScheduler(view);
  const media=view.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,requestedPaused=model.getOptions().paused,inViewport=true,width=0,height=0,droppedSeconds=0,last:number|null=null,accumulator=0;
  let unsubscribe:(()=>void)|null=null;
  let ro:ResizeObserver|undefined,io:IntersectionObserver|undefined;
  const reduced=()=>model.getOptions().reducedMotion==='system'&&media.matches;
  const blocked=()=>disposed||requestedPaused||reduced()||doc.hidden||!inViewport||width<=0||height<=0;
  const status=():SeahorseStatus=>Object.freeze({paused:blocked(),reducedMotion:reduced(),hidden:doc.hidden,inViewport,disposed,phase:model.getPhase(),tick:model.getState().tick,droppedSeconds});
  function draw(){if(disposed||width<=0||height<=0)return;const frame=model.frame(),o=model.getOptions(),cw=width/frame.columns,ch=height/frame.rows;
    ctx.fillStyle='#09151b';ctx.fillRect(0,0,width,height);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.max(5,ch*.93)}px ui-monospace,SFMono-Regular,Consolas,monospace`;
    const palette=o.palette==='brass'?[232,185,105]:o.palette==='lagoon'?[119,218,204]:[227,154,180];
    for(let i=0;i<frame.cells.length;i++){const cell=frame.cells[i]!;if(cell.glyph===' ')continue;const b=.25+cell.tone/12;ctx.fillStyle=`rgb(${palette.map(c=>Math.round(c*b)).join(',')})`;ctx.fillText(cell.glyph,(i%frame.columns+.5)*cw,(Math.floor(i/frame.columns)+.5)*ch);}
  }
  function frame(now:number){if(disposed||blocked()){sync();return;}if(last===null){last=now;return;}const dt=Math.max(0,(now-last)/1000);last=now;droppedSeconds+=Math.max(0,dt-.1);accumulator+=Math.min(.1,dt);const ticks=Math.min(6,Math.floor((accumulator+1e-10)*60));if(ticks){accumulator-=ticks/60;model.advanceTicks(ticks);draw();}}
  function sync(){if(disposed)return;if(blocked()){unsubscribe?.();unsubscribe=null;last=null;accumulator=0;}else if(!unsubscribe){last=null;unsubscribe=scheduler.subscribe(frame);}draw();}
  function resize(){if(disposed)return;const r=canvas.getBoundingClientRect();width=Math.max(0,Math.min(2048,Number.isFinite(r.width)?r.width:0));height=Math.max(0,Math.min(2048,Number.isFinite(r.height)?r.height:0));const dpr=Math.min(2,Math.max(1,view!.devicePixelRatio||1));canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);sync();}
  function motion(){sync();}function visibility(){sync();}
  function pointer(e:PointerEvent){if(disposed)return;const r=canvas.getBoundingClientRect();if(r.width<=0||r.height<=0)return;const x=(e.clientX-r.left)/r.width*2-1,y=(e.clientY-r.top)/r.height*2-1;if(Number.isFinite(x)&&Number.isFinite(y)){model.guide(x,y);draw();}}
  function leave(){if(disposed)return;model.guide(0,0);draw();}
  function greet(){if(disposed)return;model.greet(blocked());draw();}
  function dispose(){if(disposed)return;disposed=true;unsubscribe?.();unsubscribe=null;ro?.disconnect();io?.disconnect();media.removeEventListener('change',motion);doc!.removeEventListener('visibilitychange',visibility);view!.removeEventListener('resize',resize);canvas.removeEventListener('pointermove',pointer);canvas.removeEventListener('pointerdown',greet);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointercancel',leave);}
  try{media.addEventListener('change',motion);doc.addEventListener('visibilitychange',visibility);view.addEventListener('resize',resize);canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',greet);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointercancel',leave);
    const host=view as Window & {ResizeObserver?:typeof ResizeObserver;IntersectionObserver?:typeof IntersectionObserver};
    if(host.ResizeObserver){ro=new host.ResizeObserver(resize);ro.observe(canvas);}if(host.IntersectionObserver){inViewport=false;io=new host.IntersectionObserver(entries=>{if(disposed)return;inViewport=entries.some(e=>e.isIntersecting);sync();});io.observe(canvas);}resize();
  }catch(error){dispose();throw error;}
  return Object.freeze({species:'seahorse',canvas,get disposed(){return disposed;},getOptions:()=>Object.freeze({...model.getOptions(),paused:requestedPaused}),getStatus:status,getFrame:()=>model.frame(),
    update(patch:SeahorseOptions){if(disposed)return;model.configure(patch);if(patch.paused!==undefined)requestedPaused=patch.paused;sync();},play(){if(disposed)return;requestedPaused=false;sync();},pause(){if(disposed)return;requestedPaused=true;sync();},restart(){if(disposed)return;model.reset();last=null;accumulator=0;sync();},pulse:greet,guide(x:number,y:number){if(disposed)return;model.guide(x,y);draw();},resize,dispose});
}
