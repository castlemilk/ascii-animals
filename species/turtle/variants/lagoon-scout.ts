/**
 * Lagoon Scout is a private, opt-in sea turtle variation. Nothing imports it
 * from the public package, default renderer or shared gallery.
 *
 * Character/model/controller isolated from the reviewed authored proposal:
 * e82cf930cbeb4ed03d037ac19e4100731ab21ae8a695983e1c0948eae67d4dc1.
 * Original's private model/rasterizer has no injection seam, so this module
 * keeps the authored implementation while sharing its unchanged contract,
 * option validation and borrowed scheduler. Select one factory before mount;
 * dispose its TurtleArtwork before replacing it. Never mount both to switch.
 */
import { getBrowserScheduler } from '../../../src/core/scheduler.js';
import { TURTLE_DEFAULTS, normalizeTurtleOptions } from '../../../src/public/turtle.js';
import type {
  TurtleAct, TurtleArtwork, TurtleBrowserOptions, TurtleConfig,
  TurtleDirectorState, TurtleFrame, TurtleModel, TurtleMotion,
  TurtleOptions, TurtlePhase, TurtleReaction, TurtleRole, TurtleScene,
  TurtleState, TurtleStatus
} from '../../../src/public/turtle.js';

const scenes:readonly TurtleScene[]=['study','reef-passage','seagrass-stop','blue-drift'];
const roles:readonly TurtleRole[]=['navigator','forager','drifter','lookout','explorer'];
const TAU=Math.PI*2, clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const smooth=(n:number)=>{const t=clamp(n,0,1);return t*t*t*(t*(t*6-15)+10);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function bounded(value:unknown,lo:number,hi:number,name:string,integer=false):asserts value is number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi||(integer&&!Number.isInteger(value)))throw new RangeError(`Invalid ${name}`);
}
/** Keep atomic patch merging and undefined-as-no-change, then use Original's validator. */
function resolve(patch:TurtleOptions,base:TurtleConfig):TurtleConfig {
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new TypeError('Turtle options must be an object');
  for(const key of Object.keys(patch))if(!Object.hasOwn(TURTLE_DEFAULTS,key))throw new TypeError(`Unknown turtle option ${key}`);
  const candidate={...base};
  for(const key of Object.keys(TURTLE_DEFAULTS) as (keyof TurtleOptions)[]){
    const value=patch[key];if(value!==undefined)Object.defineProperty(candidate,key,{value,enumerable:true,writable:true,configurable:true});
  }
  return normalizeTurtleOptions(candidate);
}
type CueIntent='peek'|'glide'|'breath'|'dive';
interface Traveller {
  id:number;x:number;y:number;depth:number;heading:number;bank:number;stroke:number;motion:TurtleMotion;
  reactionStart:number|null;targetX:number;targetY:number;cooldown:number;
  pathX:number;pathY:number;intent:CueIntent;travel:number;cueTravel:number;excursion:number;beat:number;neck:number;breath:number;nextBreath:number;
  distance:number;screenTravel:number;cueScreenTravel:number;
}
/** One closed shoulder cycle: prepare, power, inward sweep, slow recovery, coast.
 * The two foreflippers share this clock. Their geometry has a small fixed lag,
 * never the old opposite-direction longitudinal paddling. */
function flipperCycle(beat:number){
  const p=((beat%1)+1)%1;
  if(p<.12)return mix(.18,-.40,smooth(p/.12));
  if(p<.29)return mix(-.40,.74,smooth((p-.12)/.17));
  if(p<.42)return mix(.74,.88,smooth((p-.29)/.13));
  if(p<.70)return mix(.88,.18,smooth((p-.42)/.28));
  return .18;
}
function cueEnvelope(age:number,duration:number){
  const a=age*280/duration;
  return smooth((a-24)/72)*(1-smooth((a-136)/144));
}
function cueDistance(age:number,duration:number){
  const a=age*280/duration;
  return .50*smooth(a/100)+.10*smooth((a-100)/50)+.40*smooth((a-150)/130);
}

/** Character beats live inside the established cue clock, never a renderer clock.
 * The sea turtle folds its paddles and lowers its chin; its head stays outside. */
function characterGesture(intent:CueIntent,age:number,duration:number){
  const p=clamp(age/duration,0,1);
  const fold=intent==='peek'?smooth((p-.08)/.17)*(1-smooth((p-.47)/.24)):0;
  const peek=intent==='peek'?smooth((p-.39)/.13)*(1-smooth((p-.76)/.24)):0;
  const prepare=intent==='glide'?smooth(p/.16)*(1-smooth((p-.18)/.18)):0;
  return {fold,peek,prepare};
}
function travelProgress(intent:CueIntent,age:number,duration:number){
  return intent==='glide'?smooth((age/duration-.17)/.78):intent==='peek'?smooth((age/duration-.58)/.42):cueDistance(age,duration);
}

/** The same body projection supplies both shell-local rasterization and the
 * breathing contact constraint. A screen-space centre guess cannot place a
 * lifted, pitched snout at the surface reliably. */
function turtleProjection(x:number,y:number,z:number,heading:number,bank:number,mirror:number,size:number){
  const pitch=Math.atan(Math.tan(heading*mirror)/.57),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const cr=Math.cos(bank),sr=Math.sin(bank),ry=y*cr-z*sr,rz=y*sr+z*cr;
  const px=x*cp+rz*sp,pz=-x*sp+rz*cp;
  return {x:px*mirror*size,y:(ry*.82-pz*.57)*size,z:(ry*.57+pz*.82)*size};
}
const names=['Neri','Moss','Luma','Aster','Sol'];
function identity(o:TurtleConfig,id:number){
  const item=o.individuals.find(i=>i.id===id);
  const order:TurtleRole[]=o.scene==='blue-drift'?['drifter','lookout','explorer','navigator','forager']:o.scene==='seagrass-stop'?['forager','navigator','drifter','explorer','lookout']:[...roles];
  return {id,label:item?.label??names[id]!,role:item?.role??order[id]!,size:item?.size??[1,.9,.8,.86,.75][id]!,interest:item?.interest??[.4,.9,.25,.5,.8][id]!};
}
function scenePhase(o:TurtleConfig,time:number):{phase:TurtleDirectorState['phase'];progress:number}{
  if(o.scene==='study')return {phase:'study',progress:0};
  const a=o.arrivalSeconds,l=o.lingerSeconds,d=o.departureSeconds;
  if(time<a)return {phase:'arrival',progress:clamp(time/a,0,1)};
  if(time<a+l)return {phase:'linger',progress:(time-a)/l};
  if(time<a+l+d)return {phase:'departure',progress:(time-a-l)/d};
  return {phase:'complete',progress:1};
}
const layouts:readonly (readonly (readonly [number,number,number])[])[]=[
  [[0,0,.3]],
  [[-.32,.12,.2],[.38,-.35,.75]],
  [[-.38,-.34,.55],[.34,.12,.08],[-.30,.48,.8]],
  [[-.49,-.43,.38],[.35,-.35,.75],[-.30,.33,.2],[.53,.41,.83]],
  [[-.55,-.44,.5],[.31,-.45,.75],[-.10,.05,.12],[-.57,.48,.85],[.51,.42,.6]]
];
/** Only trusted built-in routes: no arbitrary user callbacks and no ambient clocks/randomness. */
function routePose(o:TurtleConfig,id:number,time:number,life:number){
  const member=identity(o,id),slot=layouts[o.count-1]![id]!,p=(o.seed%997)*.013+id*1.73;
  const quiet=o.scene==='blue-drift',moving=o.behavior!=='rest',dir=o.facing==='left'?-1:1;
  if(o.scene==='study')return {x:0,y:moving?Math.sin(life*.40)*(.004+o.sway*.045):0,depth:.3,head:0};
  // Forward progress survives the quiet portion of each stroke. Current changes
  // the lane and effort, not the body's facing or the material's coordinates.
  let x=clamp(slot[0]*o.spacing,-.75,.75)+o.current*.06;
  const routeTime=o.director==='hold'?life:Math.max(0,time-o.arrivalSeconds);
  const rate=quiet?.009:.013,cycle=(member.role==='drifter'?7.8:5.2);
  const strokeDrift=rate*.28*cycle/TAU*(Math.sin(routeTime*TAU/cycle+p-1.25)-Math.sin(p-1.25));
  x+=dir*(moving?rate*routeTime+strokeDrift:0);
  let y=clamp(slot[1]*o.spacing,-.60,.60)+(moving?Math.sin(life*.20+p)*.018:0);
  if(o.route==='channel')y+=x*.16;
  if(o.route==='arc')y+=.07*Math.cos(x*2.4);
  if(member.role==='forager'&&o.scene==='seagrass-stop')y+=.08+Math.sin(life*.22+p)*.025;
  if(member.role==='lookout')y-=.05;
  const depth=clamp(slot[2]+(o.depth-.5)*.5+Math.sin(life*.13+p)*.025,0,1);
  const a=o.arrivalSeconds,l=o.lingerSeconds,d=o.departureSeconds,lag=id*.55;
  const enter=smooth((time-lag)/Math.max(1,a-lag));
  const leave=smooth((time-a-l-lag)/Math.max(1,d-lag));
  if(time<a){x=mix(-dir*(1.7+id*.12),x,enter);y+=Math.sin(enter*Math.PI)*(o.route==='arc'?-.14:.07);}
  if(time>=a+l){x=mix(x,dir*(1.7+id*.12),leave);y-=Math.sin(leave*Math.PI)*(o.route==='channel'?.12:.05);}
  return {x,y,depth:time<a?mix(.95,depth,enter):time>=a+l?mix(depth,.95,leave):depth,head:0};
}
function reactionAt(m:Traveller,tick:number):TurtleReaction {
  if(m.reactionStart===null)return Object.freeze({kind:'none'});
  const age=tick-m.reactionStart;
  return Object.freeze(age<90?{kind:'inspect',progress:age/90}:age<160?{kind:'bank',progress:(age-90)/70}:{kind:'recover',progress:clamp((age-160)/120,0,1)});
}
export function createLagoonScoutModel(input:TurtleOptions={}):TurtleModel {
  let options=normalizeTurtleOptions(input),tick=0,responseTick:number|null=null,targetX=0,targetY=0,guideActive=false;
  let sceneTime=options.director==='hold'?options.arrivalSeconds+options.lingerSeconds/2:0,life=0,cycle=0,selectedId=0;
  const members:Traveller[]=Array.from({length:5},(_,id)=>({id,x:0,y:0,depth:0,heading:0,bank:0,stroke:0,motion:'gliding',reactionStart:null,targetX:0,targetY:0,cooldown:0,pathX:0,pathY:0,intent:'peek',travel:0,cueTravel:0,excursion:0,beat:0,neck:0,breath:0,nextBreath:5+id*.7,distance:0,screenTravel:0,cueScreenTravel:0}));
  const state=():TurtleState=>Object.freeze({tick,responseTick,targetX,targetY});
  const phase=():TurtlePhase=>responseTick===null?'idle':tick-responseTick<45?'inspect':tick-responseTick<110?'streamline':'settle';
  function beginCue(m:Traveller,x:number,y:number,poster:boolean){
    const route=routePose(options,m.id,sceneTime,life),duration=options.scene==='study'?180:280;
    const invitation=Math.hypot(x-m.x,(y-m.y)*.85);
    m.intent=y<=-.55?'breath':y>=.55?'dive':invitation<=.38?'peek':'glide';
    m.targetX=x;m.targetY=y;m.cueTravel=m.travel;m.cueScreenTravel=m.screenTravel;
    m.distance=m.intent==='peek'?.025:m.intent==='glide'?clamp(.18+invitation*.36,.28,.55):options.count===1?.46:.32;
    m.excursion=m.intent==='breath'?Math.min(-.06,-.42-route.y):m.intent==='dive'?Math.min(.36,.73-route.y):clamp(y-route.y,m.intent==='peek'?-.035:-.23,m.intent==='peek'?.035:.23);
    m.reactionStart=tick-(poster?(duration===180?70:110):0);m.cooldown=tick+(duration===180?180:340);
    m.nextBreath=life+26+m.id*2;
  }
  function sample(snap=false){
    const dir=options.facing==='left'?-1:1,duration=options.scene==='study'?180:280;
    const worldW=Math.max(6,3.7*options.columns*.56/options.rows),worldH=worldW*options.rows/(options.columns*.56);
    for(const m of members.slice(0,options.scene==='study'?1:options.count)){
      const spec=identity(options,m.id),p=(options.seed%997)*.013+m.id*1.73;
      const route=routePose(options,m.id,sceneTime,life),act=scenePhase(options,sceneTime).phase;
      if(m.reactionStart!==null&&tick-m.reactionStart>=duration){
        m.travel=m.cueTravel+m.distance;m.reactionStart=null;
      }
      if(!snap&&options.behavior!=='rest'&&m.reactionStart===null&&tick>=m.cooldown&&life>=m.nextBreath&&(act==='linger'||act==='study')&&(spec.role==='lookout'||act==='study'))beginCue(m,m.x,-.9,false);
      const age=m.reactionStart===null?0:tick-m.reactionStart,response=reactionAt(m,tick);
      const active=m.reactionStart!==null,weight=active?cueEnvelope(age,duration):0;
      const gesture=characterGesture(m.intent,active?age:duration,duration);
      if(active){
        const progress=travelProgress(m.intent,age,duration);
        m.travel=m.cueTravel+m.distance*progress;
        if(m.intent==='glide')m.screenTravel=Math.min(.22,m.cueScreenTravel+m.distance*.45*progress);
      }
      let x=route.x+dir*m.travel,y=route.y+m.excursion*weight;
      // A held scene may make a fresh pass only after the whole animal is gone.
      // Forward distance is never unwound to pull a recovering turtle backwards.
      if(!active&&options.director==='hold'&&dir*x>1.72){m.travel-=3.44;x-=dir*3.44;}
      const near=guideActive&&m.id===selectedId&&Math.hypot(targetX-m.x,targetY-m.y)<(options.behavior==='curious'?1.2:.75);
      const assistance=options.current*dir;
      const period=(spec.role==='drifter'||options.scene==='blue-drift'?7.8:spec.role==='forager'?5.8:5.2)*(1+assistance*.16);
      const baseBeat=life/period+p/TAU;
      // Cues borrow a pair of committed strokes; phase is continuous within the
      // response and blends back to the ordinary cadence through recovery.
      const cueBeat=m.intent==='glide'?(age/duration-.11)*1.08:age/duration*1.55+.08;
      const effort=active?smooth(age/24)*(1-smooth((age-duration*.66)/(duration*.34))):0;
      const stroke=mix(flipperCycle(baseBeat),flipperCycle(cueBeat),m.intent==='peek'?0:effort);
      const vx=x-m.pathX,vy=y-m.pathY;
      m.pathX=x;m.pathY=y;
      const tangent=Math.abs(vx)+Math.abs(vy)>1e-7?Math.atan2(dir*vy*worldH,Math.max(.00002,dir*vx*worldW)):0;
      const anticipated=active&&age<24?(m.intent==='breath'?dir*-.12:m.intent==='dive'?dir*.12:m.intent==='glide'?dir*clamp(m.targetY-route.y,-.12,.12):0)*Math.sin(age/24*Math.PI):0;
      // A stationary greeting has no useful path tangent: tiny route sway must
      // not pitch a shy turtle upright. The head leads a small authored nod.
      const desired=active&&m.intent==='peek'?dir*(.09*gesture.fold-.045*gesture.peek)
        :active&&m.intent==='glide'?age<duration*.20
          ?dir*clamp(m.excursion*.45,-.10,.10)*smooth(age/(duration*.17))
          :clamp(tangent,-.27,.27)
        :options.scene==='study'&&!active?0:clamp(tangent,-.78,.78)+anticipated;
      m.heading=snap?(active?dir*(m.intent==='breath'?-.20:m.intent==='dive'?.20:0):0):m.heading+clamp((desired-m.heading)*.18,-.022,.022);
      m.depth=clamp(route.depth+(m.intent==='breath'?-.22:m.intent==='dive'?.25:0)*weight,0,1);
      m.bank=options.behavior==='rest'?0:Math.sin(life*.23+p)*.035+(active&&(m.intent==='peek'||m.intent==='glide')?Math.sin(age/duration*Math.PI)*.10:0);
      m.beat=baseBeat;m.stroke=options.behavior==='rest'?0:stroke;
      m.neck=active?(m.intent==='breath'?.28*weight:m.intent==='dive'?-.10*weight:m.intent==='peek'?-.12*gesture.fold+.09*gesture.peek:.05*gesture.prepare):near?clamp((route.y-targetY)*.08,-.04,.05):0;
      m.breath=active&&m.intent==='breath'?smooth((age*280/duration-82)/16)*(1-smooth((age*280/duration-126)/20)):0;
      if(active&&m.intent==='breath'){
        const size=options.scene==='study'?options.scale*1.12:options.scale*.92*(options.count>3?.70:1)*spec.size*(1-m.depth*.34);
        const nose=turtleProjection(-1.56-Math.max(0,m.neck)*.30,.025,.105+m.neck,m.heading,m.bank,-dir,size);
        // Only a nostril breaks the surface. The root may rise as the neck and
        // shell level out; the head cannot float above its own surface ripple.
        y=Math.max(y,-.50-nose.y*2/worldH);
      }
      // The original solo study is a horizontal tracking view. Internal forward
      // progress still drives pitch and passing water; its screen-space centre
      // remains stable through repeated automatic or explicit cues.
      m.x=options.scene==='study'?dir*m.screenTravel:x;m.y=y;
      const working=((baseBeat%1)+1)%1<.42;
      const foraging=spec.role==='forager'&&act==='linger'&&Math.sin(life*.5+p)>.15;
      m.motion=options.behavior==='rest'?'resting':active&&age>=duration*160/280?'recovering':active&&m.intent==='breath'?'surfacing':active&&m.intent==='dive'?'banking':active||near||foraging?'inspecting':working?'stroking':'gliding';
    }
  }
  sample(true);
  function director():TurtleDirectorState {
    return Object.freeze({scene:options.scene,...scenePhase(options,sceneTime),cycle,elapsed:sceneTime,selectedId,
      marker:Object.freeze({x:targetX,y:targetY,active:guideActive}),
      members:Object.freeze(members.slice(0,options.scene==='study'?1:options.count).map(m=>Object.freeze({...identity(options,m.id),x:m.x,y:m.y,depth:m.depth,heading:m.heading,bank:m.bank,stroke:m.stroke,motion:m.motion,reaction:reactionAt(m,tick)})))});
  }
  function checkId(id:number){bounded(id,0,(options.scene==='study'?1:options.count)-1,'selected id',true);}
  function guide(x:number,y:number){if(typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Guide requires finite normalized coordinates');targetX=clamp(x,-1,1);targetY=clamp(y,-1,1);guideActive=true;}
  function resetScene(){sceneTime=options.director==='hold'?options.arrivalSeconds+options.lingerSeconds/2:0;cycle=0;for(const m of members){m.reactionStart=null;m.cooldown=0;m.travel=0;m.cueTravel=0;m.excursion=0;m.screenTravel=0;m.cueScreenTravel=0;m.distance=0;m.targetX=0;m.targetY=0;m.intent='peek';m.nextBreath=life+5+m.id*.7;}sample(true);}
  function inspect(x:number,y:number,id=selectedId,poster=false){
    checkId(id);if(typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Inspection requires finite normalized coordinates');
    selectedId=id;guide(x,y);
    const m=members[id]!;
    if(!poster&&(m.reactionStart!==null||tick<m.cooldown))return;
    beginCue(m,targetX,targetY,poster);
    if(responseTick===null||poster)responseTick=tick-(poster?70:0);
    if(poster)sample(true);
  }
  function configure(patch:TurtleOptions,poster=false){
    const next=resolve(patch,options),previous=options;options=next;selectedId=Math.min(selectedId,(options.scene==='study'?1:options.count)-1);
    if(next.scene!==previous.scene)resetScene();
    else if(next.count>previous.count){for(let id=previous.count;id<next.count;id++){const m=members[id]!,p=routePose(options,id,sceneTime,life);Object.assign(m,p,{heading:p.head,reactionStart:null,cooldown:0,pathX:p.x,pathY:p.y,travel:0,cueTravel:0,excursion:0,neck:0,breath:0,screenTravel:0,cueScreenTravel:0,distance:0,nextBreath:life+5+id*.7});}}
    if(poster)sample(true);
  }
  function stage(act:TurtleAct){
    if(!['arrival','linger','departure'].includes(act))throw new TypeError('Invalid turtle act');
    if(options.scene==='study')return;
    sceneTime=act==='arrival'?options.arrivalSeconds*.73:act==='linger'?options.arrivalSeconds+options.lingerSeconds*.45:options.arrivalSeconds+options.lingerSeconds+options.departureSeconds*.44;
    for(const m of members){m.reactionStart=null;m.cooldown=0;m.travel=0;m.cueTravel=0;m.excursion=0;}responseTick=null;sample(true);
  }
  return Object.freeze({getOptions:()=>options,getState:state,getPhase:phase,getDirectorState:director,configure,
    advanceTicks(ticks:number){bounded(ticks,0,600,'ticks',true);if(!Number.isSafeInteger(tick+ticks))throw new RangeError('Tick capacity reached');
      for(let i=0;i<ticks;i++){tick++;life+=options.speed/60;
        if(options.scene!=='study'&&options.director!=='hold'){
          const total=options.arrivalSeconds+options.lingerSeconds+options.departureSeconds;
          sceneTime=Math.min(total,sceneTime+options.speed/60);
          if(sceneTime>=total&&options.director==='loop'){sceneTime=0;cycle++;for(const m of members){m.reactionStart=null;m.cooldown=0;m.travel=0;m.cueTravel=0;m.excursion=0;m.nextBreath=life+5+m.id*.7;}sample(true);}
        }
        if(responseTick!==null&&tick-responseTick>=180)responseTick=null;sample();
      }
    },guide,
    clearGuide(){targetX=targetY=0;guideActive=false;},
    greet(poster=false){const m=members[selectedId]!;inspect(guideActive?targetX:m.x+(options.facing==='left'?-.18:.18),guideActive?targetY:m.y+.10,selectedId,poster);},
    inspect,select(id:number){checkId(id);selectedId=id;},stage,
    direct(scene:TurtleScene){
      if(!scenes.includes(scene))throw new TypeError('Invalid turtle scene');
      const preset:TurtleOptions=scene==='reef-passage'?{count:3,route:'shelf',depth:.5,current:-.35,arrivalSeconds:8,lingerSeconds:18,departureSeconds:10}:
        scene==='seagrass-stop'?{count:3,route:'channel',depth:.35,current:-.15,arrivalSeconds:9,lingerSeconds:24,departureSeconds:11}:
        scene==='blue-drift'?{count:2,route:'arc',depth:.75,current:.30,arrivalSeconds:12,lingerSeconds:26,departureSeconds:12}:{count:1};
      configure({...preset,scene,behavior:'glide'});responseTick=null;guideActive=false;targetX=targetY=0;resetScene();
    },
    reset(){tick=0;responseTick=null;targetX=targetY=0;guideActive=false;life=0;selectedId=0;resetScene();},
    frame(){return renderTurtle(options,state(),phase(),director(),members,life);}
  });
}
/** Pure logical-cell rendering; no DOM, font, random or wall-clock dependency. */
function renderTurtle(o:TurtleConfig,s:TurtleState,phase:TurtlePhase,d:TurtleDirectorState,poses:readonly Traveller[],life:number):TurtleFrame {
  const cols=o.columns,rows=o.rows,worldW=Math.max(6,3.7*cols*.56/rows),worldH=worldW*rows/(cols*.56);
  const glyphs=new Array<string>(cols*rows).fill(' '),tones=new Uint8Array(cols*rows),owners=new Int8Array(cols*rows).fill(-1);
  const zbuffer=new Float64Array(cols*rows).fill(-Infinity),directed=o.scene!=='study';
  function cell(c:number,r:number,glyph:string,tone:number,owner=-1){
    if(c<0||r<0||c>=cols||r>=rows)return;const i=r*cols+c;glyphs[i]=glyph;tones[i]=clamp(Math.round(tone),0,9);owners[i]=owner;
  }
  function world(x:number,y:number,glyph:string,tone:number){cell(Math.round((x+1)/2*(cols-1)),Math.round((y+1)/2*(rows-1)),glyph,tone);}
  // A handful of graphic habitat accents; the face gets the quiet water.
  const quiet=o.scene==='blue-drift'||o.scene==='study';
  for(let i=0;i<(quiet?5:9);i++){
    const q=(i*197+o.seed*31)%1009,flow=life*(.008*o.current+.004)+(directed?0:poses[0]!.travel*(o.facing==='left'?.5:-.5));
    world(((q/1009+flow)%1+1)%1*2-1,((i*97+o.seed*13)%991)/991*1.6-.8,'.',1);
  }
  if(!directed){
    // The solo view tracks the traveler once its screen-space margin is used.
    // These two small water strokes still reveal earned, distance-dependent
    // progress on a third invitation; the body never slides backwards to reset.
    const flow=poses[0]!.travel*(o.facing==='left'?.52:-.52)+life*.004;
    for(let band=0;band<2;band++)for(let k=0;k<7;k++){
      const x=(((.24+band*.47+flow)%1+1)%1)*2-1+k/cols*2;
      world(x,band===0?-.76:.70,'-',2);
    }
  }
  // Sparse grazing light at the surface, with long gaps rather than a frame.
  for(let c=2;c<cols-2;c++){
    const x=c/(cols-1)*2-1;
    if((c+o.seed)%37<9)world(x,-.50+Math.sin(x*7+life*.16)*.005,'~',2);
  }
  if(!quiet){
    for(let c=0;c<cols;c+=2){
      const x=c/(cols-1)*2-1,y=.87+Math.sin(x*5+o.seed)*.022+Math.sin(x*11)*.009;
      world(x,y,(c%7===0)?':':'_',1);
    }
    for(let plant=0;plant<5;plant++){
      const x=-.96+plant*.47,h=.07+((plant*17+o.seed)%7)*.013;
      for(let k=0;k<9;k++)world(x+Math.sin(k*.23+life*.20+plant)*k*.002,.98-k/8*h,k<3?'|':'/',2);
    }
  }
  // Foreground blades are confined to the two corners, outside the main animal.
  for(const side of [-1,1])for(let blade=0;blade<3;blade++){
    const root=side*(.97-blade*.027),height=.09+blade*.024;
    for(let k=0;k<8;k++)world(root-side*Math.sin(k*.22+blade*.4+life*.12)*.025,.99-k/7*height,side===1?'\\':'/',2);
  }
  if(directed&&o.showRoute)for(let id=0;id<o.count;id++)for(let k=0;k<=32;k++){
    const pose=routePose(o,id,k/32*(o.arrivalSeconds+o.lingerSeconds+o.departureSeconds),0);
    world(pose.x,pose.y,k%4===0?':':'.',2);
  }
  const painting=directed?[...d.members].sort((a,b)=>b.depth-a.depth||a.id-b.id):[d.members[0]!];
  // Five large graphic plates replace the specimen's thirteen fine partitions.
  // These are deliberately cartoon markings, not an anatomical scute count.
  const plates:readonly (readonly [number,number])[]=[[0,0],[-.61,-.56],[.61,-.56],[-.61,.56],[.61,.56]];
  for(const member of painting){
    const pose=poses[member.id]!;
    if(Math.abs(member.x)>1.55||Math.abs(member.y)>1.6)continue;
    const dx=member.x*worldW/2,dy=member.y*worldH/2;
    const populationScale=o.count>3?.70:1;
    const size=directed?o.scale*.92*populationScale*member.size*(1-member.depth*.34):o.scale*1.12;
    const mirror=o.facing==='left'?1:-1,chars='..::===#O@';
    const step=clamp(Math.min(worldW/cols,worldH/rows)*.42/size,.012,.085);
    const detail=size*2.04/worldW*cols>=27;
    const age=pose.reactionStart===null?(o.scene==='study'?180:280):s.tick-pose.reactionStart;
    const gesture=characterGesture(pose.intent,age,o.scene==='study'?180:280);
    function projected(x:number,y:number,z:number){
      const p=turtleProjection(x,y,z,member.heading,member.bank,mirror,size);
      return {x:p.x+dx,y:p.y+dy,z:p.z};
    }
    function painted(c:number,r:number,depth:number,glyph:string,tone:number){
      if(c<0||c>=cols||r<0||r>=rows)return;
      const index=r*cols+c;if(depth<zbuffer[index]!)return;
      // A clear shell panel still belongs to the visible body. Its empty glyph
      // occludes rear geometry and must not become a tap-through hole. Genuine
      // water/scenery never calls this helper and retains null ownership.
      zbuffer[index]=depth;glyphs[index]=glyph;tones[index]=clamp(Math.round(tone),1,9);owners[index]=member.id;
    }
    function point(x:number,y:number,z:number,tone:number,glyph?:string,layer=0){
      const p=projected(x,y,z),c=Math.round((p.x/worldW+.5)*(cols-1)),r=Math.round((p.y/worldH+.5)*(rows-1));
      if(c<0||c>=cols||r<0||r>=rows)return;
      const depth=5-member.depth*8+p.z+layer;
      tone*=directed?1-member.depth*.17:1;
      painted(c,r,depth,glyph??chars[clamp(Math.round(tone),0,9)]!,tone);
    }
    function ellipsoid(cx:number,cy:number,cz:number,rx:number,ry:number,rz:number,tone:number,glyph='='){
      for(let y=-ry;y<=ry;y+=step)for(let x=-rx;x<=rx;x+=step){
        const q=(x/rx)**2+(y/ry)**2;if(q<=1)point(cx+x,cy+y,cz+rz*Math.sqrt(1-q),tone,glyph);
      }
    }
    // Curved paddles, sampled in their own span/chord coordinates. Skin marks
    // remain on the paddle as it rotates about a fixed shoulder or hip root.
    function flipper(side:number,rear=false){
      const stroke=member.stroke+(rear?0:side*.018),angle=rear?-.05+member.bank*.25:-stroke*.64-(side===-1?pose.breath*.65:0);
      const breathing=pose.breath;
      const span=rear?.38:((side===-1?.78:1.14)-(side===-1?.22:.10)*breathing)*(1-.64*gesture.fold),rootX=rear?.65:-.68,rootY=side*(rear?.39:.43);
      const sweep=rear?.29:.06+stroke*.32+gesture.fold*.85-gesture.prepare*.12;
      const spanSteps=Math.max(14,Math.ceil(span/step));
      for(let j=0;j<=spanSteps;j++){
        const u=j/spanSteps,width=rear?(.105*(1-u)+.12*Math.sin(Math.PI*u)):(.14*(1-u)+.23*Math.pow(Math.sin(Math.PI*u),.70));
        const divisions=Math.max(2,Math.ceil(width*2/step));
        for(let k=0;k<=divisions;k++){
          const v=k/divisions*2-1;
          const x=rootX+sweep*u+.09*Math.sin(Math.PI*u)+width*v;
          const y=rootY+side*span*u*Math.cos(angle);
          const z=-.055+span*u*Math.sin(angle)+.035*Math.sin(Math.PI*u)*(1-v*v);
          const edge=k===0||k===divisions;
          const tone=rear?5:side===1?6:5;
          point(x,y,z,edge?7:tone,edge?'+':'=');
        }
      }
    }
    flipper(-1);flipper(1);flipper(-1,true);flipper(1,true);
    ellipsoid(1.01,.01,-.04,.25,.065,.03,5);
    // Continuous neck under the carapace. The breath lifts and extends the head;
    // it never shrinks into the shell and the eye remains part of the skull.
    const neck=pose.neck,headX=-1.31-Math.max(0,neck)*.30-gesture.peek*.07,headZ=.045+neck;
    ellipsoid(-.98,-.005,neck*.40,.34,.19,.11,5);
    ellipsoid(headX,-.006,headZ,.36,.34,.16,6);
    ellipsoid(headX-.265,.045,headZ+.015,.105,.17,.06,6);
    // Sample the projected shell at cell centres exactly once. A point-cloud
    // blank used to erase lower rim samples and leave a broken, skeletal edge.
    const centre=projected(0,0,.17),uEnd=projected(1.03,0,.17),vEnd=projected(0,.72,.17);
    const ux=uEnd.x-centre.x,uy=uEnd.y-centre.y,vx=vEnd.x-centre.x,vy=vEnd.y-centre.y,det=ux*vy-uy*vx;
    const rx=Math.hypot(ux,vx),ry=Math.hypot(uy,vy);
    const left=Math.max(0,Math.floor(((centre.x-rx)/worldW+.5)*(cols-1))),right=Math.min(cols-1,Math.ceil(((centre.x+rx)/worldW+.5)*(cols-1)));
    const top=Math.max(0,Math.floor(((centre.y-ry)/worldH+.5)*(rows-1))),bottom=Math.min(rows-1,Math.ceil(((centre.y+ry)/worldH+.5)*(rows-1)));
    for(let r=top;r<=bottom;r++)for(let c=left;c<=right;c++){
      const px=(c/(cols-1)-.5)*worldW-centre.x,py=(r/(rows-1)-.5)*worldH-centre.y;
      const u=(px*vy-py*vx)/det,v=(py*ux-px*uy)/det,q=u*u+v*v;if(q>1)continue;
      let first=Infinity,second=Infinity,plate=0;
      for(let j=0;j<plates.length;j++){
        const seed=plates[j]!,distance=(u-seed[0])**2+(v-seed[1])**2*.93;
        if(distance<first){second=first;first=distance;plate=j;}else if(distance<second)second=distance;
      }
      const rim=q>.82,seam=!rim&&second-first<(detail?.090:.13),island=first<(plate===0?.10:.065);
      const surface=projected(u*1.03,v*.72,.17);
      painted(c,r,5-member.depth*8+surface.z+.24,rim?'#':seam?'+':island?'=':' ',rim?7:seam?7:island?4:3);
    }
    // The facial anchors are large, sparse and explicit. They are part of the
    // head projection and carry its owner; no raster overlay or Unicode eyes.
    const eyeX=headX-.055,eyeY=.07,eyeZ=headZ+.20;
    const sleepy=gesture.fold>.62&&gesture.peek<.30;
    const blink=pose.reactionStart===null&&((s.tick+o.seed*11+member.id*41)%421)>410;
    const eye=projected(eyeX,eyeY,eyeZ),ec=Math.round((eye.x/worldW+.5)*(cols-1)),er=Math.round((eye.y/worldH+.5)*(rows-1)),eyeDepth=5-member.depth*8+eye.z+.7;
    const gaze=pose.reactionStart!==null?pose.targetX-member.x:d.marker.active&&member.id===d.selectedId?d.marker.x-member.x:0;
    // A five-cell eye is a readable face anchor at 80 columns; a single O never
    // expands into an accidental cluster. The whole stamp follows the skull.
    const largeEye=detail&&size>.65,eyeRows=sleepy||blink?['_____']:largeEye?['.---.','( @ )',"'---'"]:['(o)'];
    for(let row=0;row<eyeRows.length;row++)for(let col=0;col<eyeRows[row]!.length;col++){
      const glyph=eyeRows[row]![col]!;
      painted(ec+col-Math.floor(eyeRows[row]!.length/2),er+row-Math.floor(eyeRows.length/2),eyeDepth,glyph,glyph==='@'?9:8);
    }
    if(largeEye&&!sleepy&&!blink){
      const pupil=clamp(Math.round(gaze*1.7),-1,1);
      painted(ec,er,eyeDepth+.01,' ',8);painted(ec+pupil,er,eyeDepth+.02,'@',9);
    }
    point(headX-.265,.24,headZ+.10,8,'v',.78);
    point(headX-.20,.26,headZ+.10,8,'_',.78);
    if(pose.breath>.25){
      const nose=projected(headX-.25,.025,headZ+.06),nx=nose.x/worldW*2,ny=nose.y/worldH*2;
      // A small surface break anchored at the actual snout, not an effect at the
      // target marker. Long disconnected bubbles would obscure the anatomy.
      for(let k=-3;k<=3;k++)if(Math.abs(k)>1)world(nx+k/cols*2,ny-.022+(Math.abs(k)-2)*.007,'~',4);
      world(nx,ny-.035,'.',5);
    }
  }
  if(directed&&o.showLabels)for(const member of d.members){
    if(Math.abs(member.x)>.95||Math.abs(member.y)>.9)continue;
    const label=`${member.id===d.selectedId?'>':' '}${member.id+1} ${member.label}`;
    const c=clamp(Math.round((member.x+1)/2*(cols-1))-Math.floor(label.length/2),1,cols-label.length-1);
    const extent=o.scale*.84*(o.count>3?.70:1)*member.size*(1-member.depth*.43)*1.50/worldH*2;
    const r=clamp(Math.round((member.y+extent+1)/2*(rows-1))+1,1,rows-2);
    for(let j=0;j<label.length;j++)cell(c+j,r,label[j]!,member.id===d.selectedId?7:4);
  }
  if(directed&&d.marker.active){world(d.marker.x,d.marker.y,'+',8);world(d.marker.x-.025,d.marker.y,'.',5);world(d.marker.x+.025,d.marker.y,'.',5);}
  const cells=Object.freeze(glyphs.map((glyph,i)=>Object.freeze({glyph,tone:tones[i]!,ownerId:owners[i]!<0?null:owners[i]!})));
  let text='';for(let r=0;r<rows;r++)text+=glyphs.slice(r*cols,(r+1)*cols).join('')+(r===rows-1?'':'\n');
  return Object.freeze({columns:cols,rows,cells,text,phase});
}
/** Browser-only mount, SSR-safe import. Owns no scheduler, timer, font asset or global event handler. */
export function createLagoonScoutArtwork(canvas:HTMLCanvasElement,input:TurtleBrowserOptions={}):TurtleArtwork {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Options must be an object');
  const {frameSource,...raw}=input;
  if(frameSource!==undefined&&(!frameSource||typeof frameSource.subscribe!=='function'))throw new TypeError('Invalid borrowed frameSource');
  const model=createLagoonScoutModel(raw),view=canvas?.ownerDocument?.defaultView,doc=canvas?.ownerDocument;
  if(!view||!doc)throw new TypeError('Canvas must belong to a browser document');
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas2D unavailable');
  const ctx:CanvasRenderingContext2D=context,scheduler=frameSource??getBrowserScheduler(view),media=view.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,requestedPaused=model.getOptions().paused,inViewport=true,width=0,height=0,droppedSeconds=0,last:number|null=null,accumulator=0;
  let unsubscribe:(()=>void)|null=null,ro:ResizeObserver|undefined,io:IntersectionObserver|undefined;
  let pendingGuide:{x:number;y:number}|null=null,lastFrame:TurtleFrame|null=null,lastNotice='',pointerGuide=false;
  const listeners=new Set<(status:TurtleStatus)=>void>();
  const reduced=()=>model.getOptions().reducedMotion==='system'&&media.matches;
  const complete=()=>model.getOptions().director==='once'&&model.getDirectorState().phase==='complete';
  const blocked=()=>disposed||requestedPaused||reduced()||doc.hidden||!inViewport||width<=0||height<=0||complete();
  const status=():TurtleStatus=>{const d=model.getDirectorState();return Object.freeze({paused:blocked(),reducedMotion:reduced(),hidden:doc.hidden,inViewport,disposed,phase:model.getPhase(),tick:model.getState().tick,droppedSeconds,scene:d.scene,act:d.phase,selectedId:d.selectedId,cycle:d.cycle});};
  function notify(force=false){
    if(disposed)return;const s=status(),d=model.getDirectorState();
    const signature=[s.paused,s.reducedMotion,s.hidden,s.inViewport,s.phase,d.scene,d.phase,d.selectedId,d.cycle,Math.floor(d.progress*10),...d.members.map(m=>m.motion)].join('|');
    if(!force&&signature===lastNotice)return;lastNotice=signature;
    for(const listener of [...listeners])if(listeners.has(listener))listener(s);
  }
  function draw(){
    if(disposed||width<=0||height<=0)return;
    const f=model.frame(),o=model.getOptions();lastFrame=f;const cw=width/f.columns,ch=height/f.rows;
    ctx.fillStyle='#09151b';ctx.fillRect(0,0,width,height);ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`${Math.max(3,Math.min(ch*.93,cw/ .56))}px ui-monospace,SFMono-Regular,Consolas,monospace`;
    // Material colours make the face, skin and bold shell border distinct while
    // keeping the established palette option and 0–9 logical tone contract.
    const colours=o.palette==='brass'
      ?['#09151b','#29414a','#173b36','#61763f','#91a65b','#76b8a3','#a2d8ba','#f0dba6','#fff1c7','#fff8e6']
      :o.palette==='lagoon'
      ?['#09151b','#29414a','#123c42','#387f7c','#58b7ab','#60b4b6','#a7e1d4','#caefda','#f3f8de','#ffffff']
      :['#09151b','#29414a','#452f43','#855765','#c2868a','#af929f','#e4b9b6','#f5d8c4','#fff0dd','#fff8ee'];
    for(let i=0;i<f.cells.length;i++){const cell=f.cells[i]!;if(cell.glyph===' ')continue;
      ctx.fillStyle=cell.ownerId===null&&cell.tone<=2?'#29414a':colours[cell.tone]!;
      ctx.fillText(cell.glyph,(i%f.columns+.5)*cw,(Math.floor(i/f.columns)+.5)*ch);
    }
  }
  function frame(now:number){
    if(disposed||blocked()){sync();return;}if(!Number.isFinite(now))return;
    if(pendingGuide){model.guide(pendingGuide.x,pendingGuide.y);pendingGuide=null;pointerGuide=true;}
    if(last===null){last=now;return;}
    const dt=Math.max(0,(now-last)/1000);last=now;droppedSeconds+=Math.max(0,dt-.1);accumulator+=Math.min(.1,dt);
    const ticks=Math.min(6,Math.floor((accumulator+1e-10)*60));
    if(ticks){accumulator-=ticks/60;model.advanceTicks(ticks);draw();notify();if(complete())sync();}
  }
  function sync(force=false){
    if(disposed)return;
    if(blocked()){unsubscribe?.();unsubscribe=null;last=null;accumulator=0;pendingGuide=null;if(pointerGuide){model.clearGuide();pointerGuide=false;}}
    else if(!unsubscribe){last=null;unsubscribe=scheduler.subscribe(frame);}
    draw();notify(force);
  }
  function resize(){
    if(disposed)return;const r=canvas.getBoundingClientRect();width=Math.max(0,Math.min(2048,Number.isFinite(r.width)?r.width:0));height=Math.max(0,Math.min(2048,Number.isFinite(r.height)?r.height:0));
    const ratio=Number.isFinite(view!.devicePixelRatio)?view!.devicePixelRatio:1,dpr=Math.min(2,Math.max(1,ratio||1));
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);sync();
  }
  function motion(){if(disposed)return;pendingGuide=null;pointerGuide=false;model.clearGuide();sync(true);}
  function visibility(){sync();}
  function coordinates(e:PointerEvent){
    const r=canvas.getBoundingClientRect();if(!Number.isFinite(r.width)||!Number.isFinite(r.height)||r.width<=0||r.height<=0)return null;
    const x=(e.clientX-r.left)/r.width*2-1,y=(e.clientY-r.top)/r.height*2-1;
    return Number.isFinite(x)&&Number.isFinite(y)?{x:clamp(x,-1,1),y:clamp(y,-1,1)}:null;
  }
  function pointer(e:PointerEvent){if(disposed||blocked())return;const p=coordinates(e);if(p)pendingGuide=p;}
  function leave(){if(disposed)return;pendingGuide=null;if(pointerGuide){model.clearGuide();pointerGuide=false;draw();notify();}}
  function press(e:PointerEvent){
    if(disposed||e.button!==undefined&&e.button!==0)return;const p=coordinates(e);if(!p)return;pendingGuide=null;pointerGuide=false;
    const f=lastFrame??model.frame(),c=clamp(Math.round((p.x+1)/2*(f.columns-1)),0,f.columns-1),r=clamp(Math.round((p.y+1)/2*(f.rows-1)),0,f.rows-1);
    const owner=f.cells[r*f.columns+c]!.ownerId;
    model.inspect(p.x,p.y,owner??model.getDirectorState().selectedId,blocked());draw();notify(true);
  }
  function greet(){if(disposed)return;pointerGuide=false;model.greet(blocked());draw();notify(true);}
  function keyboard(e:KeyboardEvent){
    if(disposed||e.altKey||e.ctrlKey||e.metaKey)return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Escape','b','B','d','D','p','P','g','G'].includes(e.key))return;
    e.preventDefault();pendingGuide=null;pointerGuide=false;
    const d=model.getDirectorState(),m=d.members[d.selectedId]!,x=d.marker.active?d.marker.x:m.x,y=d.marker.active?d.marker.y:m.y;
    if(e.key.toLowerCase()==='p')model.inspect(clamp(m.x,-1,1),clamp(m.y,-.5,.5),d.selectedId,blocked());
    else if(e.key.toLowerCase()==='g'){
      const direction=model.getOptions().facing==='left'?-1:1,ahead=clamp(m.x+direction*.70,-1,1);
      model.inspect(Math.abs(ahead-m.x)>=.40?ahead:clamp(m.x-direction*.70,-1,1),clamp(m.y,-.5,.5),d.selectedId,blocked());
    }
    else if(e.key.toLowerCase()==='b'||e.key.toLowerCase()==='d')model.inspect(clamp(m.x,-1,1),e.key.toLowerCase()==='b'?-.9:.9,d.selectedId,blocked());
    else if(e.key==='Enter')model.inspect(clamp(x,-1,1),clamp(y,-1,1),d.selectedId,blocked());
    else if(e.key==='Escape')model.clearGuide();
    else model.guide(clamp(x+(e.key==='ArrowRight'?.12:e.key==='ArrowLeft'?-.12:0),-1,1),clamp(y+(e.key==='ArrowDown'?.12:e.key==='ArrowUp'?-.12:0),-1,1));
    draw();notify(true);
  }
  function dispose(){
    if(disposed)return;disposed=true;unsubscribe?.();unsubscribe=null;pendingGuide=null;lastFrame=null;listeners.clear();ro?.disconnect();io?.disconnect();
    media.removeEventListener('change',motion);doc!.removeEventListener('visibilitychange',visibility);view!.removeEventListener('resize',resize);
    canvas.removeEventListener('pointermove',pointer);canvas.removeEventListener('pointerdown',press);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointercancel',leave);canvas.removeEventListener('lostpointercapture',leave);canvas.removeEventListener('keydown',keyboard);
  }
  function stillIfNecessary(){if((requestedPaused||reduced())&&model.getOptions().scene!=='study')model.stage('linger');}
  try{
    media.addEventListener('change',motion);doc.addEventListener('visibilitychange',visibility);view.addEventListener('resize',resize);
    canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',press);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointercancel',leave);canvas.addEventListener('lostpointercapture',leave);canvas.addEventListener('keydown',keyboard);
    const host=view as Window&{ResizeObserver?:typeof ResizeObserver;IntersectionObserver?:typeof IntersectionObserver};
    if(host.ResizeObserver){ro=new host.ResizeObserver(resize);ro.observe(canvas);}
    if(host.IntersectionObserver){inViewport=false;io=new host.IntersectionObserver(entries=>{if(disposed)return;inViewport=entries.some(e=>e.isIntersecting);sync();});io.observe(canvas);}
    stillIfNecessary();resize();
  }catch(error){dispose();throw error;}
  return Object.freeze({species:'turtle',canvas,get disposed(){return disposed;},getOptions:()=>Object.freeze({...model.getOptions(),paused:requestedPaused}),getStatus:status,getFrame:()=>model.frame(),getDirectorState:()=>model.getDirectorState(),
    update(patch:TurtleOptions){if(disposed)return;const before=model.getOptions();model.configure(patch,blocked());if(patch.paused!==undefined)requestedPaused=patch.paused;if(before.scene!==model.getOptions().scene)stillIfNecessary();sync(true);},
    play(){if(disposed)return;requestedPaused=false;sync(true);},pause(){if(disposed)return;requestedPaused=true;sync(true);},
    restart(){if(disposed)return;model.reset();droppedSeconds=0;last=null;accumulator=0;pendingGuide=null;stillIfNecessary();sync(true);},pulse:greet,
    guide(x:number,y:number){if(disposed)return;model.guide(x,y);pendingGuide=null;pointerGuide=false;draw();notify(true);},
    clearGuide(){if(disposed)return;pendingGuide=null;pointerGuide=false;model.clearGuide();draw();notify(true);},
    direct(scene:TurtleScene){if(disposed)return;model.direct(scene);last=null;accumulator=0;pendingGuide=null;stillIfNecessary();sync(true);},
    stage(act:TurtleAct){if(disposed)return;model.stage(act);last=null;accumulator=0;pendingGuide=null;sync(true);},
    select(id:number){if(disposed)return;model.select(id);draw();notify(true);},
    inspect(x:number,y:number,id?:number){if(disposed)return;model.inspect(x,y,id,blocked());pendingGuide=null;pointerGuide=false;draw();notify(true);},
    subscribe(listener:(status:TurtleStatus)=>void){
      if(typeof listener!=='function')throw new TypeError('Listener must be a function');if(disposed)return ()=>{};
      listeners.add(listener);try{listener(status());}catch(error){listeners.delete(listener);throw error;}return ()=>{listeners.delete(listener);};
    },resize,dispose});
}
