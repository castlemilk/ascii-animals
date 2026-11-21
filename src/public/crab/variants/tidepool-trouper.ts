/**
 * Private opt-in Crab variation: Tidepool Trouper.
 *
 * The shipped createCrabArtwork and package exports remain Original.
 * Adoption seam (owned by the gallery coordinator): choose this factory or
 * Original BEFORE construction, dispose the previous controller, then hand the
 * one new controller/canvas to the existing renderer lifecycle. Preserve caller
 * pause intent, force reducedMotion:'system', and dispose before removing the
 * host. Never mount Original beneath this variation or run two painters on a
 * canvas. Import this file explicitly inside the repo; it is not a package API.
 *
 * This variation is the authored single-character study (scene:'study', count:1).
 * Original retains all multi-resident theatre scenes. Its pure model below is
 * reused only for validated options and compatible scene metadata; no Original
 * Canvas controller, painter, observer or animation loop is created.
 */
import { getBrowserScheduler } from '../../../core/scheduler.js';
import {
  createCrabModel as createOriginalModel,
  type CrabAction, type CrabActivity, type CrabArtwork, type CrabBeat,
  type CrabBehaviorState, type CrabBrowserOptions, type CrabCell, type CrabConfig,
  type CrabFrame, type CrabModel, type CrabOptions, type CrabPhase,
  type CrabSceneState, type CrabState, type CrabStatus,
} from '../../crab.js';
import { createCrabStudy, studyLayout, type CrabStudyPose } from './tidepool-trouper-study.js';

const TAU=Math.PI*2, clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
function requireStudy(options:CrabConfig):void {
  if(options.scene!=='study'||options.count!==1)
    throw new RangeError("Tidepool Trouper supports scene:'study' and count:1; choose Original for theatre scenes");
}

/** Pure private study facade; no DOM, wall clock or scheduler work. */
export function createTidepoolTrouperModel(input:CrabOptions={}):CrabModel {
  const original=createOriginalModel(input);
  requireStudy(original.getOptions());
  let responseTick:number|null=null;
  const tick=()=>original.getState().tick;
  const study=createCrabStudy(original.getOptions,tick);
  const state=():CrabState=>Object.freeze({...original.getState(),responseTick});
  const phase=():CrabPhase=>responseTick===null?'idle':tick()-responseTick<45?'notice':tick()-responseTick<110?'defend':'settle';
  const scene=():CrabSceneState=>{
    const metadata=original.getScene(),p=study.snapshot();
    const kind:CrabActivity=p.action==='forage'?'scuttle':p.action==='signal'?'signal':p.action==='shelter'?'shelter':'rest';
    const actor=Object.freeze({...metadata.actors[0]!,x:p.x,y:p.y,
      home:Object.freeze({x:0,y:p.y}),patch:Object.freeze({x:p.targetX,y:p.y}),
      behavior:Object.freeze({kind,progress:clamp(p.age/180,0,1)}) as CrabBehaviorState,
      leftClaw:p.left,rightClaw:p.right,gazeX:p.gazeX,gazeY:p.gazeY,crouch:p.crouch,feet:p.feet});
    return Object.freeze({...metadata,actors:Object.freeze([actor])});
  };
  function cue(action:CrabAction,id?:number,poster=false) {
    if(!['forage','signal','shelter'].includes(action))throw new TypeError('Invalid crab cue');
    if(id!==undefined&&id!==0)throw new RangeError('Invalid resident');
    if(study.cue(action,poster))responseTick=tick()-(poster?90:0);
  }
  return Object.freeze({
    getOptions:original.getOptions,getState:state,getPhase:phase,getScene:scene,
    configure(patch:CrabOptions) {
      // Reject unsupported mode changes before the Original validator can mutate.
      if(patch&&((patch.scene!==undefined&&patch.scene!=='study')||(patch.count!==undefined&&patch.count!==1)))
        throw new RangeError("Tidepool Trouper supports scene:'study' and count:1");
      const before=original.getOptions();original.configure(patch);study.configure(before);
      if(before.seed!==original.getOptions().seed)responseTick=null;
    },
    advanceTicks(ticks:number) {
      if(!Number.isInteger(ticks)||ticks<0||ticks>600)throw new RangeError('Ticks must be an integer0..600');
      for(let i=0;i<ticks;i++){original.advanceTicks(1);study.step();}
      if(responseTick!==null&&tick()-responseTick>=180)responseTick=null;
    },
    guide(x:number,y:number){original.guide(x,y);const target=original.getState();study.guide(target.targetX,target.targetY);},
    clearGuide(){original.clearGuide();study.clearGuide();},
    greet(poster=false){cue('signal',undefined,poster);},cue,
    reset(){original.reset();responseTick=null;study.reset();},
    frame(){return renderCrab(original.getOptions(),study.snapshot(),phase());},
    select:original.select,setBeat:original.setBeat,nextBeat:original.nextBeat,
  });
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
  const glyph=(value:string|undefined)=>mirror<0&&value!==undefined
    ?({'/':'\\','\\':'/','<':'>','>':'<'} as Record<string,string>)[value]??value:value;
  return {
    point(px,py,t,g){ink.point(...map([px,py]),t,glyph(g));},
    ellipse(px,py,rx,ry,t,g){ink.ellipse(...map([px,py]),rx*r,ry*sy,t,glyph(g));},
    line(px,py,qx,qy,w,t,g){ink.line(...map([px,py]),...map([qx,qy]),w*r,t,glyph(g));},
    polygon(points,t,g){ink.polygon(points.map(map),t,glyph(g));}
  };
}

/** Tidepool Trouper: original graphic shapes, readable chelae and attending eyes.
 * Flat tones carry form. No mottling, random texture or raster reference tracing. */
function paintShoreCrab(p:CrabInk,a:{left:number;right:number;crouch:number;gazeX:number;gazeY:number;feet:readonly CrabPoint[];planted:readonly boolean[];detail:boolean;seed:number;lean?:number;leftReach?:number;rightReach?:number;leftOpen?:number;rightOpen?:number}){
  const lean=a.lean??0,compress=1-a.crouch*.28,drop=a.crouch*.36;
  const body=([x,y]:CrabPoint):CrabPoint=>[x+lean*(.85-y*.14),y*compress+drop+lean*x*.22];
  const polygon=(points:readonly CrabPoint[],tone:number,glyph='#')=>p.polygon(points.map(body),tone,glyph);
  const line=(x:number,y:number,xx:number,yy:number,width:number,tone:number,glyph='=')=>p.line(...body([x,y]),...body([xx,yy]),width,tone,glyph);

  // Eight limbs attach to the shield; the planted toes belong to the ground.
  // A single strong stroke per segment keeps the four fans legible at 80×32.
  for(let k=3;k>=0;k--)for(const side of [-1,1]){
    const index=(side<0?0:4)+k,toe=a.feet[index]!;
    const hip=body([side*(.70-k*.035),-.08+k*.14]);
    const knee:CrabPoint=[hip[0]+(toe[0]-hip[0])*.57,hip[1]+(toe[1]-hip[1])*.37+(k-1.45)*.15];
    p.line(...hip,...knee,.048,4,'#');
    p.line(...knee,...toe,.021,6,side<0?'/':'\\');
    if(a.planted[index])p.line(toe[0]-.055,toe[1],toe[0]+.055,toe[1],0,7,'_');
  }

  // A dark lower lip gives the body weight; only two broad shell planes remain.
  polygon([[-.86,.12],[-.75,.40],[-.37,.58],[.37,.58],[.75,.40],[.86,.12]],3);
  polygon([[-.94,-.04],[-.71,-.40],[-.34,-.56],[.30,-.52],[.70,-.35],[.96,-.04],[.72,.25],[.30,.39],[-.34,.39],[-.74,.24]],5);
  polygon([[-.78,-.08],[-.60,-.30],[-.24,-.44],[.24,-.40],[.57,-.23],[.65,-.10],[.24,-.22],[-.20,-.23],[-.54,-.05]],6,'+');
  line(-.64,.27,-.27,.39,0,4,'_');line(-.27,.39,.28,.39,0,4,'_');

  for(const side of [-1,1]){
    const lift=side<0?a.left:a.right,reach=side<0?a.leftReach??0:a.rightReach??0;
    const open=side<0?a.leftOpen??Math.max(0,lift):a.rightOpen??Math.max(0,lift);
    const cx=side*(1.39+reach*.38),cy=-.58-lift*.45;
    const elbow=body([side*(1.02+reach*.12),-.13-lift*.12]);
    const wrist=body([cx,cy+.27]);
    p.line(...body([side*.69,-.08]),...elbow,.075,4,'#');
    p.line(...elbow,...wrist,.069,6,'+');
    // Concave polygon leaves genuine empty jaw space, without painting a hole
    // over habitat or creating invisible owned cells. The two tips stay attached.
    const size=side<0?1.04:.96,gap=.53+clamp(open,0,1)*.30,aim=-.55+reach*.22;
    const start=aim+gap,end=aim+TAU-gap,outer:CrabPoint[]=[],inner:CrabPoint[]=[];
    const m=(angle:number,rx:number,ry:number):CrabPoint=>body([cx-side*Math.cos(angle)*rx*size,cy+Math.sin(angle)*ry*size]);
    for(let i=0;i<=16;i++){const angle=start+(end-start)*i/16;outer.push(m(angle,.57,.47));}
    for(let i=16;i>=0;i--){const angle=start+(end-start)*i/16;inner.push(m(angle,.25+.06*open,.205+.035*open));}
    p.polygon([...outer,...inner],6,'#');
    for(let i=3;i<9;i++)p.line(...outer[i]!,...outer[i+1]!,0,7,'*');
    p.point(...outer[0]!,8,'>');p.point(...outer[16]!,8,'<');
  }

  // Stalks and eyes remain separated from both claws and the shell. Eyelids and
  // pupils, not extra shell shading, carry curiosity, resolve and the side-eye.
  for(const side of [-1,1]){
    const ex=side*.36+a.gazeX*.08,ey=-.96+a.gazeY*.035+(side<0?.03:-.04)+a.crouch*.14;
    line(side*.27,-.40,ex,ey+.10,.028,6,'/');
    const center=body([ex,ey]);
    p.ellipse(...center,.19,.24,8,'O');
    p.ellipse(center[0]+a.gazeX*.055,center[1]+a.gazeY*.035,.052,.073,0,'@');
    const slope=side*.035+(a.left-a.right)*.035;
    p.line(...body([ex-.17,ey-.23-slope]),...body([ex+.17,ey-.23+slope]),0,4,'=');
  }
  // Small mouthparts, intentionally graphic; no human teeth or floating smile.
  line(-.10,.12,.02,.16,0,3,'_');line(.02,.16,.14,.09,0,7,'/');
}

/** Single-character stage. Contacts and actions use the same fixed-tick model
 * in the gallery, classic studio and text export. Habitat is glyphs as well. */
function renderCrab(o:CrabConfig,s:CrabStudyPose,phase:CrabPhase):CrabFrame {
  const raster=crabRaster(o),layout=studyLayout(o),r=layout.radius,sy=layout.yScale;
  const sand=raster.ink('sand'),water=raster.ink('water');
  // Two quiet tide strokes and a few anchored sand marks give the feet a world.
  for(let c=4;c<o.columns-4;c++){
    const x=c/(o.columns-1)*2-1;
    if(c%16<10)water.point(x,.70+Math.sin(x*4)*.026,3,'~');
    if(c%23<5)sand.point(x,.55,2,'_');
  }
  for(const [x,y] of [[-.78,.38],[.74,.41],[-.64,.53],[.59,.56]] as const){sand.line(x-.035,y,x+.035,y,0,2,'_');}
  const mirror=o.facing==='left'?1:-1;
  const index=(k:number)=>mirror<0?(k<4?k+4:k-4):k;
  const feet:CrabPoint[]=Array.from({length:8},(_,k)=>{
    const foot=s.feet[index(k)]!;return [(foot.x-s.x)/(r*mirror),(foot.y-foot.lift-s.y)/sy] as const;
  });
  // A compact contact shadow stays beneath the body, not around its silhouette.
  const shadow=localCrabInk(sand,s.x,s.y,r,sy);shadow.line(-.72,.48,.72,.48,0,1,'.');
  paintShoreCrab(localCrabInk(raster.ink('crab',0),s.x,s.y,r,sy,mirror),{
    left:mirror<0?s.right:s.left,right:mirror<0?s.left:s.right,
    leftReach:mirror<0?s.rightReach:s.leftReach,rightReach:mirror<0?s.leftReach:s.rightReach,
    leftOpen:mirror<0?s.rightOpen:s.leftOpen,rightOpen:mirror<0?s.leftOpen:s.rightOpen,
    crouch:s.crouch,lean:s.lean*mirror,gazeX:s.gazeX*mirror,gazeY:s.gazeY,feet,
    planted:Array.from({length:8},(_,k)=>s.feet[index(k)]!.planted),detail:r*(o.columns-1)>16,seed:o.seed
  });
  if(s.action==='forage'&&s.age<110){
    const cue=raster.ink('cue');cue.point(s.targetX,.54,7,'v');cue.line(s.targetX-.035,.58,s.targetX+.035,.58,0,7,'_');
  }
  return raster.frame(phase);
}


/** Browser-only mount, SSR-safe import. Reduced-motion policy stays authoritative. */
export function createTidepoolTrouperArtwork(canvas:HTMLCanvasElement,input:CrabBrowserOptions={}):CrabArtwork {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Options must be an object');
  const {frameSource,...raw}=input;
  const model=createTidepoolTrouperModel(raw),view=canvas?.ownerDocument?.defaultView,doc=canvas?.ownerDocument;
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
  // Fit rectangular cells instead of stretching the creature or overlapping
  // adjacent glyphs on a tall phone canvas. The hit transform uses this same box.
  function contentBox(){const o=model.getOptions(),ch=Math.min(height/o.rows,width/(o.columns*.56)),cw=ch*.56;
    return {cw,ch,x:(width-cw*o.columns)/2,y:(height-ch*o.rows)/2,w:cw*o.columns,h:ch*o.rows};}
  function draw(){if(disposed||width<=0||height<=0||doc!.hidden||!inViewport)return;const frame=model.frame(),o=model.getOptions(),box=contentBox();
    ctx.fillStyle='#09151b';ctx.fillRect(0,0,width,height);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${Math.max(.5,box.ch*.90)}px ui-monospace,SFMono-Regular,Consolas,monospace`;
    const colors=o.palette==='brass'?['#0b2025','#263e43','#793e36','#a64e3e','#cf6749','#ed8051','#ff9e66','#ffd19d','#fff0ce','#fff8e5']
      :o.palette==='lagoon'?['#0b2025','#193b43','#28646b','#367d7d','#4c9f95','#72b9a6','#94d2b7','#bedec6','#f0eed1','#fff8e5']
      :['#0b2025','#42313e','#703c54','#9d5066','#c5677d','#e58da0','#f5abba','#ffd0ca','#fff0dc','#fff8e5'];
    for(let i=0;i<frame.cells.length;i++){const cell=frame.cells[i]!;if(cell.glyph===' ')continue;
      ctx.fillStyle=cell.layer==='water'?'#417674':cell.layer==='sand'?'#52625c':cell.layer==='rock'?`rgb(${[59,96,96].map(c=>Math.round(c*(.45+cell.tone*.12))).join(',')})`:cell.layer==='cue'?'#c5e4c5':colors[cell.tone]!;
      ctx.fillText(cell.glyph,box.x+(i%frame.columns+.5)*box.cw,box.y+(Math.floor(i/frame.columns)+.5)*box.ch);
    }
  }
  function frame(now:number){if(disposed||blocked()){sync();return;}if(!Number.isFinite(now)){last=null;return;}if(last===null){last=now;return;}const dt=Math.max(0,(now-last)/1000);last=now;droppedSeconds+=Math.max(0,dt-.1);accumulator+=Math.min(.1,dt);const ticks=Math.min(6,Math.floor((accumulator+1e-10)*60));if(ticks){accumulator-=ticks/60;model.advanceTicks(ticks);draw();notify();}}
  function sync(){if(disposed)return;if(blocked()){unsubscribe?.();unsubscribe=null;last=null;accumulator=0;}else if(!unsubscribe){last=null;unsubscribe=scheduler.subscribe(frame);}draw();notify(true);}
  function resize(){if(disposed)return;const r=canvas.getBoundingClientRect();width=Math.max(0,Math.min(2048,Number.isFinite(r.width)?r.width:0));height=Math.max(0,Math.min(2048,Number.isFinite(r.height)?r.height:0));const dpr=Math.min(2,Math.max(1,view!.devicePixelRatio||1));canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);sync();}
  function motion(){sync();}function visibility(){sync();}
  function coords(e:PointerEvent):[number,number]|null{if(e.isPrimary===false)return null;const r=canvas.getBoundingClientRect(),box=contentBox();if(r.width<=0||r.height<=0||box.w<=0||box.h<=0)return null;
    const px=(e.clientX-r.left)/r.width*width,py=(e.clientY-r.top)/r.height*height;
    if(px<box.x||px>box.x+box.w||py<box.y||py>box.y+box.h)return null;
    const x=(px-box.x)/box.w*2-1,y=(py-box.y)/box.h*2-1;return Number.isFinite(x)&&Number.isFinite(y)?[clamp(x,-1,1),clamp(y,-1,1)]:null;}
  let press: PointerEvent | null = null;
  function pointer(e:PointerEvent){if(disposed||e.pointerType==='touch'||e.pointerType==='pen')return;const p=coords(e);if(p){model.guide(...p);if(blocked())draw();}}
  function leave(){if(disposed)return;model.clearGuide();draw();notify(true);}
  function cancelPress(){press=null;}
  function up(e:PointerEvent){
    if(!press||press.pointerId!==e.pointerId)return;
    const start=press;press=null;
    if(Math.hypot(start.clientX-e.clientX,start.clientY-e.clientY)<=12){hit(e);leave();}
  }
  function greet(){if(disposed)return;model.greet(blocked());draw();notify(true);}
  function cue(action:CrabAction,id?:number){if(disposed)return;model.cue(action,id,blocked());draw();notify(true);}
  function down(e:PointerEvent){
    if(disposed||e.isPrimary===false||e.button!==0)return;
    if(e.pointerType==='touch'||e.pointerType==='pen'){press=e;return;}
    hit(e);
  }
  function hit(e:PointerEvent){
    if(disposed)return;const p=coords(e);if(!p)return;const frame=model.frame();model.guide(...p);
    const c=Math.round((p[0]+1)*.5*(frame.columns-1)),r=Math.round((p[1]+1)*.5*(frame.rows-1));
    // Only a visible creature glyph owns a hit: sand, waves, labels and covering rocks do not.
    const cell=frame.cells[r*frame.columns+c];
    cue(cell?.layer==='crab'&&cell.glyph!==' '?'signal':'forage');
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
  function dispose(){if(disposed)return;disposed=true;unsubscribe?.();unsubscribe=null;listeners.clear();ro?.disconnect();io?.disconnect();media.removeEventListener('change',motion);doc!.removeEventListener('visibilitychange',visibility);view!.removeEventListener('resize',resize);canvas.removeEventListener('pointermove',pointer);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointercancel',cancelPress);canvas.removeEventListener('lostpointercapture',cancelPress);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('keydown',keyboard);}
  try{media.addEventListener('change',motion);doc.addEventListener('visibilitychange',visibility);view.addEventListener('resize',resize);canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointercancel',cancelPress);canvas.addEventListener('lostpointercapture',cancelPress);canvas.addEventListener('pointerup',up);canvas.addEventListener('keydown',keyboard);
    const host=view as Window & {ResizeObserver?:typeof ResizeObserver;IntersectionObserver?:typeof IntersectionObserver};
    if(host.ResizeObserver){ro=new host.ResizeObserver(resize);ro.observe(canvas);}if(host.IntersectionObserver){inViewport=false;io=new host.IntersectionObserver(entries=>{if(disposed)return;inViewport=entries.some(e=>e.isIntersecting);sync();});io.observe(canvas);}resize();
  }catch(error){dispose();throw error;}
  return Object.freeze({species:'crab',canvas,get disposed(){return disposed;},getOptions:()=>Object.freeze({...model.getOptions(),paused:requestedPaused}),getStatus:status,getFrame:()=>model.frame(),
    update(patch:CrabOptions){if(disposed)return;model.configure(patch);if(patch.paused!==undefined)requestedPaused=patch.paused;if(blocked()&&(patch.scene!==undefined||patch.formation!==undefined))model.setBeat(model.getScene().beat,true);sync();},play(){if(disposed)return;requestedPaused=false;sync();},pause(){if(disposed)return;requestedPaused=true;sync();},restart(){if(disposed)return;model.reset();last=null;accumulator=0;sync();},pulse:greet,guide(x:number,y:number){if(disposed)return;model.guide(x,y);draw();notify(true);},resize,dispose,
    getScene:model.getScene,select(id:number){if(disposed)return;model.select(id);draw();notify(true);},cue,setBeat,nextBeat,clearGuide:leave,
    subscribe(listener:(status:CrabStatus)=>void){if(typeof listener!=='function')throw new TypeError('Subscriber must be a function');if(disposed)return ()=>{};const entry=(s:CrabStatus)=>listener(s);listeners.add(entry);try{entry(status());}catch(error){listeners.delete(entry);throw error;}return ()=>{listeners.delete(entry);};}
  });
}
