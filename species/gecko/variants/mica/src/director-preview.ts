/** Private Mica habitat and portrait; no scene simulation is forked. */
import { rasterizeGeckos } from './preview.js';
import type { GeckoCellWriter } from './preview.js';
import { GECKO_DIRECTOR_LIMITS } from '../../../compiled/director.js';
import type { GeckoDirectorState, GeckoIndividualId } from '../../../compiled/director.js';
import type { GeckoGrid, GeckoViewport, Vec2 } from '../../../compiled/types.js';

export interface GeckoDirectorPreviewOptions {
  readonly cols?:number;readonly rows?:number;readonly neutral?:boolean;
  /** null is the full wall; an ID gives a portrait, fixed when autonomy is off. */
  readonly focus?:GeckoIndividualId|null;
}
const clamp=(v:number,lo:number,hi:number):number=>Math.max(lo,Math.min(hi,v));
function line(put:GeckoCellWriter,a:Vec2,b:Vec2,glyph:string,material:number,spacing=.045,depth=-5):void {
  const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/spacing);
  for(let i=0;i<=n;i++){const t=n?i/n:0;put(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,glyph,.4,material,depth);}
}
/** Graphic habitat marks are fixed wall coordinates, never a moving texture. */
function environment(state:GeckoDirectorState,put:GeckoCellWriter,focus:GeckoIndividualId|null):void {
  // Broad broken seams give the adhered toes a stable visual reference.
  const seams=[[-2.42,.98,-1.50,.98],[-2.06,-.30,-1.22,-.30],[-.36,.82,.48,.82],
    [-.54,-.62,.20,-.62],[1.09,.48,1.99,.48],[1.30,-1.06,2.05,-1.06]] as const;
  for(const [x,y,x2,y2] of seams) {
    line(put,{x,y},{x:x2,y:y2},'_',4,.085);
    line(put,{x:x+.08,y:y+.04},{x:x+.08,y:y+.22},'|',8,.09);
  }
  // Large crack turns replace weathering, dust and nested hatching.
  for(const [x,y] of [[-2.30,.12],[.55,-.05],[2.43,.82]] as const) {
    line(put,{x,y},{x:x+.15,y:y-.20},'/',4,.10);
    line(put,{x:x+.15,y:y-.20},{x:x+.08,y:y-.37},'\\',4,.10);
  }
  const stem={x:2.95,y:1.66};
  line(put,stem,{x:2.69,y:1.10},'/',6,.10);
  for(const t of [.3,.6,.85]) {
    const p={x:stem.x-.26*t,y:stem.y-.56*t};
    line(put,p,{x:p.x-.17,y:p.y-.02},'_',6,.10);
    line(put,p,{x:p.x+.08,y:p.y-.13},'/',6,.10);
  }
  if(state.options.scene==='lantern-hunt'||state.moth.visible) {
    const lamp={x:.78,y:-1.53};
    line(put,{x:lamp.x,y:-1.93},{x:lamp.x,y:lamp.y-.14},'|',4,.08);
    line(put,{x:lamp.x-.18,y:lamp.y-.11},{x:lamp.x+.18,y:lamp.y-.11},'_',12,.08);
    line(put,{x:lamp.x-.16,y:lamp.y-.08},{x:lamp.x-.12,y:lamp.y+.17},'|',7,.08);
    line(put,{x:lamp.x+.16,y:lamp.y-.08},{x:lamp.x+.12,y:lamp.y+.17},'|',7,.08);
    line(put,{x:lamp.x-.12,y:lamp.y+.19},{x:lamp.x+.12,y:lamp.y+.19},'_',12,.08);
    put(lamp.x,lamp.y+.04,'*',1,7);
  }
  if(state.options.showRoutes)for(const actor of state.individuals) {
    for(let i=0;i<actor.route.length;i++)line(put,actor.route[i]!,actor.route[(i+1)%actor.route.length]!,'.',6,.17,-3);
  }
  if(state.shadow.active) {
    const p=state.shadow.position,shift=(state.shadow.progress-.5)*1.9;
    for(const edge of [-.27,.27])line(put,{x:p.x+shift-.22+edge,y:-1.0},{x:p.x+shift+.30+edge,y:1.35},'/',8,.10,-.4);
  }
  const visible=focus?state.individuals.filter(a=>a.id===focus):state.individuals;
  for(const actor of visible)for(const foot of actor.body.feet)if(foot.phase==='stance') {
    put(foot.position.x*actor.scale+.025,foot.position.y*actor.scale+.045,'.',.18,11,-.2);
  }
  if(state.pointer) {
    const p=state.pointer;put(p.x,p.y,'+',.9,7,.8);
  }
  if(state.moth.visible) {
    const p=state.moth.position,fold=(Math.sin(state.tick*.32)+1)/2,wing=.105+.035*fold;
    // Five large marks: a clear target, including on the 64-column phone wall.
    put(p.x,p.y,'*',1,7,1);
    put(p.x-wing,p.y-.055,'\\',1,7,1);put(p.x+wing,p.y-.055,'/',1,7,1);
    put(p.x-wing*.85,p.y+.07,'/',1,7,1);put(p.x+wing*.85,p.y+.07,'\\',1,7,1);
  }
}
export function renderGeckoDirectorGrid(state:GeckoDirectorState,options:GeckoDirectorPreviewOptions={}):GeckoGrid {
  if(!options||typeof options!=='object'||Array.isArray(options)||![Object.prototype,null].includes(Object.getPrototypeOf(options)))throw new TypeError('Director preview must be a plain object');
  for(const key of Reflect.ownKeys(options))if(typeof key!=='string'||!['cols','rows','neutral','focus'].includes(key))throw new TypeError(`Unknown director preview field ${String(key)}`);
  const cols=options.cols===undefined?224:options.cols,rows=options.rows===undefined?112:options.rows;
  if(!Number.isSafeInteger(cols)||cols<64||cols>256||!Number.isSafeInteger(rows)||rows<40||rows>168)throw new RangeError('Director grid must be 64..256 by 40..168');
  if(options.neutral!==undefined&&typeof options.neutral!=='boolean')throw new TypeError('neutral must be boolean');
  const focused=options.focus==null?null:state.individuals.find(a=>a.id===options.focus);
  if(options.focus!=null&&!focused)throw new RangeError('Focus must name an active individual');
  // Deliberate encounters keep their wall stationary. Autonomous classic scenes
  // retain the original follow camera so long routes do not crop the character.
  // In either view, the wall and all stance pads share the same world transform.
  const focusCenter=focused?(state.options.autonomy?focused.body.position:focused.body.habitat.origin):null;
  const viewport:GeckoViewport=focused
    ?{width:2.6,height:2.7,centerX:focusCenter!.x*focused.scale,centerY:focusCenter!.y*focused.scale}
    :{width:GECKO_DIRECTOR_LIMITS.worldWidth,height:GECKO_DIRECTOR_LIMITS.worldHeight,centerX:0,centerY:0};
  const layers=(focused?[focused]:state.individuals).map(a=>{
    const p={x:a.body.position.x*a.scale,y:a.body.position.y*a.scale};
    const target=['stalk','poise','strike'].includes(a.motive)?state.moth.position:a.goal;
    const delta=target?Math.atan2(target.y-p.y,target.x-p.x)-a.body.heading:0;
    const angle=Math.atan2(Math.sin(delta),Math.cos(delta));
    const headTurn=clamp(angle,-.44,.44);
    // The director already eases this expression every fixed tick. Reusing that
    // continuous signal lets a held gathering pose unfold during the strike and
    // relax after returning, with no renderer-owned history or phase pop.
    const gather=clamp((a.tailExpression-.10)/.09,0,1);
    const crouch=gather*gather*(3-2*gather);
    // A long hook counterbalances the skull. This changes only the attached
    // tail expression; the four latched contacts are passed through untouched.
    return {state:{...a.body,tailCurl:Math.max(a.body.tailCurl,Math.min(.76,.12+a.tailExpression*2.2))},scale:a.scale,
      pose:{headTurn,gaze:clamp(angle*2,-1,1),crouch,headReach:.028-.080*crouch,jawOpen:a.motive==='strike'?1:0}};
  });
  const grid=rasterizeGeckos(layers,cols,rows,viewport,options.neutral??false,put=>environment(state,put,focused?.id??null));
  return {...grid,viewport,theme:'moonlight'};
}
