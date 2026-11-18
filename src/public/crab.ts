import { getBrowserScheduler } from '../core/scheduler.js';
/** Borrowed scheduler subscription; controller never owns or disposes it. */
export interface CrabFrameSource { subscribe(callback:(timestamp:number)=>void):()=>void }

export interface CrabOptions {
  columns?: number; rows?: number; seed?: number; speed?: number; scale?: number;
  sway?: number; facing?: 'left' | 'right'; behavior?: 'scuttle' | 'curious' | 'guard';
  palette?: 'brass' | 'lagoon' | 'rose'; paused?: boolean;
  reducedMotion?: 'system' | 'ignore';
}
export type CrabConfig = Readonly<Required<CrabOptions>>;
export const CRAB_DEFAULTS: CrabConfig = Object.freeze({ columns:120, rows:50, seed:7,
  speed:1, scale:1, sway:.18, facing:'left', behavior:'scuttle', palette:'brass', paused:false, reducedMotion:'system' });
const ranges = { columns:[80,180], rows:[32,90], seed:[0,2147483647], speed:[.25,2], scale:[.6,1.3], sway:[0,.4] } as const;
function resolve(patch: CrabOptions, base: CrabConfig): CrabConfig {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Crab options must be an object');
  for(const key of Object.keys(patch)) if(!Object.hasOwn(CRAB_DEFAULTS,key)) throw new TypeError(`Unknown crab option ${key}`);
  const candidate = {...base};
  for(const key of Object.keys(CRAB_DEFAULTS) as (keyof CrabOptions)[]) {
    const value=patch[key]; if(value!==undefined) Object.defineProperty(candidate,key,{value,enumerable:true,writable:true,configurable:true});
  }
  for(const [key,[lo,hi]] of Object.entries(ranges)) {
    const value=candidate[key as keyof typeof ranges];
    if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi||(['columns','rows','seed'].includes(key)&&!Number.isInteger(value))) throw new RangeError(`Invalid ${key}`);
  }
  if(!['left','right'].includes(candidate.facing)||!['scuttle','curious','guard'].includes(candidate.behavior)||!['brass','lagoon','rose'].includes(candidate.palette)||!['system','ignore'].includes(candidate.reducedMotion)||typeof candidate.paused!=='boolean') throw new TypeError('Invalid crab setting');
  return Object.freeze(candidate);
}
/** The base-taking merge helper is private; all public configuration is validated. */
export function normalizeCrabOptions(patch: CrabOptions = {}): CrabConfig { return resolve(patch,CRAB_DEFAULTS); }
export interface CrabState { readonly tick:number; readonly responseTick:number|null; readonly targetX:number; readonly targetY:number }
export type CrabPhase = 'idle'|'notice'|'defend'|'settle';
export interface CrabCell { readonly glyph:string; readonly tone:number }
export interface CrabFrame { readonly columns:number; readonly rows:number; readonly cells:readonly CrabCell[]; readonly text:string; readonly phase:CrabPhase }
export interface CrabModel {
  getOptions():CrabConfig; getState():CrabState; getPhase():CrabPhase;
  configure(patch:CrabOptions):void; advanceTicks(ticks:number):void; guide(x:number,y:number):void; greet(poster?:boolean):void; reset():void;
  frame():CrabFrame;
}
const TAU=Math.PI*2, clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function createCrabModel(input:CrabOptions={}):CrabModel {
  let options=normalizeCrabOptions(input),tick=0,responseTick:number|null=null,targetX=0,targetY=0;
  const state=():CrabState=>Object.freeze({tick,responseTick,targetX,targetY});
  const phase=():CrabPhase=>responseTick===null?'idle':tick-responseTick<45?'notice':tick-responseTick<110?'defend':'settle';
  return Object.freeze({getOptions:()=>options,getState:state,getPhase:phase,
    configure(patch:CrabOptions){options=resolve(patch,options);},
    advanceTicks(ticks:number){if(!Number.isInteger(ticks)||ticks<0||ticks>600)throw new RangeError('Ticks must be an integer0..600');tick+=ticks;if(responseTick!==null&&tick-responseTick>=180)responseTick=null;},
    guide(x:number,y:number){if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Guide requires finite normalized coordinates');targetX=clamp(x,-1,1);targetY=clamp(y,-1,1);},
    greet(poster=false){if(responseTick===null)responseTick=tick-(poster?70:0);},reset(){tick=0;responseTick=null;targetX=targetY=0;},
    frame(){return renderCrab(options,state(),phase());}
  });
}
/** Pure logical-cell rendering; no DOM, font, random or wall-clock dependency. */
function renderCrab(o:CrabConfig,s:CrabState,phase:CrabPhase):CrabFrame {
  const cols=o.columns,rows=o.rows,worldW=Math.max(6,3.7*cols*.56/rows),worldH=worldW*rows/(cols*.56);
  const glyphs=new Array<string>(cols*rows).fill(' '),tones=new Uint8Array(cols*rows);
  const t=s.tick/60*o.speed,seedPhase=(o.seed%997)/997*TAU;
  const age=s.responseTick===null?0:s.tick-s.responseTick;
  const lift=o.behavior==='guard'?1:s.responseTick===null?0:Math.sin(Math.PI*clamp(age/180,0,1));
  const dx=o.behavior==='curious'?s.targetX*.3:o.behavior==='scuttle'?Math.sin(t*.65+seedPhase)*o.sway:0;
  const bounce=o.behavior==='guard'?0:Math.sin(t*7)*.025;
  const mirror=o.facing==='left'?1:-1, chars='.,:;+=*#%@';
  function point(x:number,y:number,tone:number,glyph?:string){
    x=x*o.scale*mirror+dx;y=y*o.scale+bounce;
    const c=Math.round((x/worldW+.5)*(cols-1)),r=Math.round((y/worldH+.5)*(rows-1));
    if(c<0||c>=cols||r<0||r>=rows)return;const i=r*cols+c;
    glyphs[i]=glyph??chars[clamp(Math.round(tone),0,9)]!;tones[i]=clamp(Math.round(tone),1,9);
  }
  const step=worldH/rows*.32;
  function disk(cx:number,cy:number,r:number,tone:number,glyph?:string){for(let y=-r;y<=r;y+=step)for(let x=-r;x<=r;x+=step)if(x*x+y*y<=r*r)point(cx+x,cy+y,tone,glyph);point(cx,cy,tone,glyph);}
  function line(x:number,y:number,xx:number,yy:number,r:number,tone:number,glyph?:string){const n=Math.max(1,Math.ceil(Math.hypot(xx-x,yy-y)/step));for(let k=0;k<=n;k++){const a=k/n;disk(x+(xx-x)*a,y+(yy-y)*a,r,tone,glyph);}}
  function ellipse(cx:number,cy:number,rx:number,ry:number,tone:number){for(let y=-ry;y<=ry;y+=step)for(let x=-rx;x<=rx;x+=step){const q=x*x/(rx*rx)+y*y/(ry*ry);if(q<=1)point(cx+x,cy+y,tone+(1-q)*1.8-y/ry*.4);}}
  // Eight separately jointed walking legs: four on each side, not chelipeds.
  for(const side of [-1,1])for(let k=3;k>=0;k--){
    const gait=o.behavior==='guard'?0:Math.sin(t*6+k*1.6+side)*.09;
    const y=-.1+k*.17, kneeY=-.15+k*.26+gait, footY=.12+k*.29;
    const reach=1.25+(3-k)*.17;
    line(side*.62,y,side*reach,kneeY,.055,5.4);
    line(side*reach,kneeY,side*(reach+.27),footY,.038,7);
    line(side*(reach+.27),footY,side*(reach+.15),footY+.13,.018,8);
  }
  // Paired chelipeds: articulated elbow, broad palm, two gaping tapered fingers.
  for(const side of [-1,1]){
    const x=side*1.38,y=-.73-lift*.38;
    line(side*.48,-.23,side*.92,-.58-lift*.08,.12,5.5);
    line(side*.92,-.58-lift*.08,x,y,.10,6.5);
    ellipse(x,y,.27,.22,6.5);
    const gape=.16+lift*.12;
    line(x-side*.13,y-.12,x-side*(.24+gape),y-.40,.085,7);
    line(x-side*(.24+gape),y-.40,x-side*.13,y-.53,.035,8);
    line(x+side*.12,y-.12,x+side*(.22+gape),y-.39,.085,7);
    line(x+side*(.22+gape),y-.39,x+side*.10,y-.53,.035,8);
  }
  ellipse(0,.04,.79,.48,5.5);
  // Scalloped shell rim and ornamental plate texture retain a broad carapace.
  for(let k=0;k<30;k++){const a=Math.PI+k/29*Math.PI;point(Math.cos(a)*.81,.04+Math.sin(a)*.49,8,'#');}
  for(let k=0;k<7;k++)line(-.46+k*.15,-.12,-.42+k*.14,.2,.012,4,':');
  for(const side of [-1,1]){line(side*.31,-.31,side*.39,-.63,.045,7);disk(side*.39,-.65,.065,9,'O');}
  line(-.15,.26,.15,.26,.018,8,'=');
  const cells=Object.freeze(glyphs.map((glyph,i)=>Object.freeze({glyph,tone:tones[i]!})));
  let text='';for(let r=0;r<rows;r++)text+=glyphs.slice(r*cols,(r+1)*cols).join('')+(r===rows-1?'':'\n');
  return Object.freeze({columns:cols,rows,cells,text,phase});
}
export interface CrabBrowserOptions extends CrabOptions { frameSource?:CrabFrameSource }
export interface CrabStatus { readonly paused:boolean; readonly reducedMotion:boolean; readonly hidden:boolean; readonly inViewport:boolean; readonly disposed:boolean; readonly phase:CrabPhase; readonly tick:number; readonly droppedSeconds:number }
export interface CrabArtwork {
  readonly species:'crab'; readonly canvas:HTMLCanvasElement; readonly disposed:boolean;
  getOptions():CrabConfig; getStatus():CrabStatus; getFrame():CrabFrame;
  update(options:CrabOptions):void; play():void; pause():void; restart():void;
  pulse():void; guide(x:number,y:number):void; resize():void; dispose():void;
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
  const media=view.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,requestedPaused=model.getOptions().paused,inViewport=true,width=0,height=0,droppedSeconds=0,last:number|null=null,accumulator=0;
  let unsubscribe:(()=>void)|null=null;
  let ro:ResizeObserver|undefined,io:IntersectionObserver|undefined;
  const reduced=()=>model.getOptions().reducedMotion==='system'&&media.matches;
  const blocked=()=>disposed||requestedPaused||reduced()||doc.hidden||!inViewport||width<=0||height<=0;
  const status=():CrabStatus=>Object.freeze({paused:blocked(),reducedMotion:reduced(),hidden:doc.hidden,inViewport,disposed,phase:model.getPhase(),tick:model.getState().tick,droppedSeconds});
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
  return Object.freeze({species:'crab',canvas,get disposed(){return disposed;},getOptions:()=>Object.freeze({...model.getOptions(),paused:requestedPaused}),getStatus:status,getFrame:()=>model.frame(),
    update(patch:CrabOptions){if(disposed)return;model.configure(patch);if(patch.paused!==undefined)requestedPaused=patch.paused;sync();},play(){if(disposed)return;requestedPaused=false;sync();},pause(){if(disposed)return;requestedPaused=true;sync();},restart(){if(disposed)return;model.reset();last=null;accumulator=0;sync();},pulse:greet,guide(x:number,y:number){if(disposed)return;model.guide(x,y);draw();},resize,dispose});
}
