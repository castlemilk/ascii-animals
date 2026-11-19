/** Original side-profile construction. No image, sprite, ASCII drawing or ray geometry. */
import type { FoxFoot, FoxLeg, FoxLegId, FoxMaterial, FoxOptions, FoxPoint, FoxPolygon, FoxPose, FoxState } from './types.js';
import { FOX_LIMITS, clamp, smooth } from './config.js';
import type { FoxExpression } from './director-types.js';

const LEG_IDS:readonly FoxLegId[]=['far-hind','far-front','near-hind','near-front'];
const REST_X=[-.46,.10,-.29,.27] as const;

export function neutralFeet(rootX:number, options:FoxOptions):readonly FoxFoot[] {
  const sign=options.facing==='right'?1:-1;
  return LEG_IDS.map((id,i)=>{const x=rootX+sign*REST_X[i]!*options.scale;
    return {id,x,y:FOX_LIMITS.groundY,mode:'planted',progress:1,fromX:x,toX:x};});
}

function ellipse(x:number,y:number,rx:number,ry:number,count=16):FoxPoint[] {
  return Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2;return {x:x+Math.cos(a)*rx,y:y+Math.sin(a)*ry};});
}
function bone(a:FoxPoint,b:FoxPoint,ra:number,rb:number):FoxPoint[] {
  const length=Math.hypot(b.x-a.x,b.y-a.y)||1;
  const nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
  return [{x:a.x+nx*ra,y:a.y+ny*ra},{x:b.x+nx*rb,y:b.y+ny*rb},
    {x:b.x-nx*rb,y:b.y-ny*rb},{x:a.x-nx*ra,y:a.y-ny*ra}];
}
function cubic(a:FoxPoint,b:FoxPoint,c:FoxPoint,d:FoxPoint,t:number):FoxPoint {
  const q=1-t;
  return {x:q*q*q*a.x+3*q*q*t*b.x+3*q*t*t*c.x+t*t*t*d.x,
    y:q*q*q*a.y+3*q*q*t*b.y+3*q*t*t*c.y+t*t*t*d.y};
}

/** Pure pose sampling; output vertices are world-space normalized x/y, +y down. */
export function poseFox(state:FoxState, liveOptions:FoxOptions, expression?:FoxExpression):FoxPose {
  const b=state.behavior, options='plan' in b?b.plan.options:liveOptions;
  const sign=options.facing==='right'?1:-1, scale=options.scale;
  let lift=0,compression=0,tailBalance=0,air=0,land=1,crouch=0;
  if(b.kind==='crouch') {crouch=smooth(b.age/(options.crouchTicks-1));compression=.085*crouch;tailBalance=-.14*crouch;}
  if(b.kind==='airborne') {
    air=b.age/options.airTicks;lift=-4*options.pounceHeight*air*(1-air);
    compression=.085*(1-smooth(air/.18));tailBalance=-.14*Math.cos(Math.PI*air);
  }
  if(b.kind==='landing') {
    land=smooth(b.age/(options.landingTicks-1));compression=.065*Math.sin(Math.PI*land);tailBalance=.14*(1-land);
  }
  if(b.kind==='recover') {
    const u=b.age/(options.recoveryTicks-1);
    compression=.012*Math.sin(u*Math.PI*2)*(1-u);
  }
  const calm=!['crouch','airborne','landing'].includes(b.kind);
  const breath=calm?Math.sin(state.breathPhase)*options.breathing:0;
  const restAmount=clamp(expression?.rest??0,0,1),bowAmount=clamp(expression?.bow??0,0,1);
  // Weight follows the planted/swing feet, not an independent bobbing clock.
  // Torso and attached coat share this deformation; stance paws remain fixed.
  const swing=(id:FoxLegId)=>{
    const foot=state.feet.find(item=>item.id===id);
    return calm&&foot?.mode==='swing'?Math.sin(Math.PI*foot.progress):0;
  };
  const shoulderLoad=swing('near-front')-swing('near-hind');
  const gaitLift=(swing('near-front')+swing('near-hind')+swing('far-front')+swing('far-hind'))*.004;
  const bodyY=lift+compression+.19*scale*restAmount-gaitLift;
  const headDip=b.kind==='sniff'? options.sniffDepth*(.62+.22*Math.sin(state.breathPhase*2)+.16*state.target.y)
    :b.kind==='stalk'?options.sniffDepth*.35:0;
  const point=(x:number,y:number,head=false):FoxPoint=>{
    if(head&&expression?.headPitch){const angle=clamp(expression.headPitch,-.35,.35),dx=x-.23,dy=y+.43;
      x=.23+dx*Math.cos(angle)-dy*Math.sin(angle);y=-.43+dx*Math.sin(angle)+dy*Math.cos(angle);}
    return {x:state.rootX+sign*x*scale,
      y:FOX_LIMITS.groundY+(y*(1-restAmount*.18)+(head?headDip:0)
        +bowAmount*.075*clamp(x+.25,0,.8)+x*shoulderLoad*.018)*scale+bodyY};
  };
  const earPoint=(p:FoxPoint,near:boolean):FoxPoint=>{
    const angle=clamp((near?expression?.earNear:expression?.earFar)??0,-.35,.35);
    if(!angle)return p;const cx=near?.375:.24,cy=near?-.545:-.58,dx=p.x-cx,dy=p.y-cy;
    return{x:cx+dx*Math.cos(angle)-dy*Math.sin(angle),y:cy+dx*Math.sin(angle)+dy*Math.cos(angle)};
  };
  const polygons:FoxPolygon[]=[],legs:FoxLeg[]=[];
  const add=(id:string,material:FoxMaterial,depth:number,points:readonly FoxPoint[]):void=>{polygons.push({id,material,depth,points});};
  const local=(id:string,material:FoxMaterial,depth:number,points:readonly FoxPoint[],head=false):void=>{
    add(id,material,depth,points.map(p=>{const q=id.startsWith('ear-')?earPoint(p,id.startsWith('ear-near')):p;return point(q.x,q.y,head);}));};
  const neutral=neutralFeet(state.rootX,options);

  for(let i=0;i<4;i++) {
    const id=LEG_IDS[i]!,fore=id.endsWith('front'),near=id.startsWith('near');
    const rest=neutral[i]!,held=state.feet[i]!;
    let foot:FoxPoint={x:held.x,y:held.y};
    let planted=held.mode==='planted';
    if(b.kind==='crouch') {
      foot={x:held.x+(rest.x-held.x)*crouch,y:held.y+(FOX_LIMITS.groundY-held.y)*crouch};
      planted=Math.abs(foot.y-FOX_LIMITS.groundY)<.00001;
    } else if(b.kind==='airborne') {
      const tuck=Math.sin(Math.PI*air),extension=smooth((air-.5)/.5);
      foot={x:rest.x+sign*(fore?.07:-.07)*tuck*scale,
        y:FOX_LIMITS.groundY+lift-(fore?.13:.18)*tuck*scale-(fore?0:.07*extension)};
      planted=false;
    } else if(b.kind==='landing') {
      foot={x:rest.x,y:FOX_LIMITS.groundY-(fore?0:.07*(1-land))};
      planted=fore||land===1;
    } else if('plan' in b) {foot={x:rest.x,y:FOX_LIMITS.groundY};planted=true;}
    if(restAmount){foot={x:foot.x+sign*(fore?-.02:.035)*scale*restAmount,y:foot.y};}
    const root=point(fore?(near?.21:.12):(near?-.31:-.40),fore?-.30:-.32);
    const knee={x:root.x+sign*(fore?-.025:.105)*scale+(foot.x-rest.x)*.3,
      y:FOX_LIMITS.groundY-(fore?.15:.17)*scale*(1-restAmount*.65)+bodyY*(.6-.35*restAmount)+(foot.y-FOX_LIMITS.groundY)*.4};
    const hock={x:foot.x-sign*.04*scale,y:FOX_LIMITS.groundY-.065*scale+(foot.y-FOX_LIMITS.groundY)*.8+bodyY*.15};
    const joints=fore?[root,knee,foot]:[root,knee,hock,foot];
    legs.push({id,joints,planted});
    const depth=near?4:0;
    for(let j=0;j<joints.length-1;j++)add(`${id}-bone-${j}`,near?(j===0?'fur':'shadow'):'shadow',depth,
      bone(joints[j]!,joints[j+1]!,scale*(j===0?.044:.027),scale*.023));
    const spread=planted?1+.15*crouch+(b.kind==='landing'?.22*Math.sin(Math.PI*land):0):.84;
    const toeLift=planted?0:Math.max(0,FOX_LIMITS.groundY-foot.y)*.13;
    add(`${id}-paw`,'shadow',depth+.05,[{x:foot.x-sign*.027*scale*spread,y:foot.y-.026*scale},
      {x:foot.x+sign*.035*scale*spread,y:foot.y-.029*scale},
      {x:foot.x+sign*.071*scale*spread,y:foot.y-.012*scale-toeLift},
      {x:foot.x+sign*.069*scale*spread,y:foot.y+.011*scale-toeLift},
      {x:foot.x-sign*.029*scale*spread,y:foot.y+.011*scale}]);
    if(near)add(`${id}-ankle-light`,'fur',depth+.08,
      bone(joints[joints.length-2]!,foot,scale*.009,scale*.006));
  }

  // A bushy tapered curve, with width measured normal to its tangent.
  const sway=Math.sin(state.tailPhase)*options.tailSway;
  const tailLift=clamp(expression?.tailLift??0,-.26,.22);
  const a={x:-.39,y:-.38},bb={x:-.57,y:-.28-restAmount*.06},
    c={x:-.83+restAmount*.48,y:-.12+sway*.45+tailLift*.6-restAmount*.18},
    d={x:-1.015+restAmount*1.1,y:-.16+sway*.7+tailBalance+tailLift*1.35-restAmount*.28};
  // Each ribbon uses exactly the same moving centerline and tangent. Coat
  // layers therefore bend with the brush instead of sliding across its cells.
  const tailSection=(start:number,end=1,lower=-1,upper=1):FoxPoint[]=>{
    const left:FoxPoint[]=[],right:FoxPoint[]=[];
    for(let i=0;i<=16;i++) {
      const t=start+(end-start)*i/16,p=cubic(a,bb,c,d,t);
      const prev=cubic(a,bb,c,d,Math.max(0,t-.001)),next=cubic(a,bb,c,d,Math.min(1,t+.001));
      const len=Math.hypot(next.x-prev.x,next.y-prev.y)||1;
      const width=t===1?0:(.042*(1-t)+.125*Math.pow(Math.sin(Math.PI*t),.85))
        *(1+.035*Math.sin(t*Math.PI*14));
      const nx=-(next.y-prev.y)/len,ny=(next.x-prev.x)/len;
      left.push({x:p.x+nx*width*upper,y:p.y+ny*width*upper});
      right.push({x:p.x+nx*width*lower,y:p.y+ny*width*lower});
    }
    return [...left,...right.reverse()];
  };
  local('tail','fur',1,tailSection(0));
  local('tail-dorsal','shadow',1.02,tailSection(.08,.82,.30,.98));
  local('tail-flank','fur',1.04,tailSection(.12,.83,-.48,.28));
  local('tail-undercoat','shadow',1.06,tailSection(.12,.86,-.98,-.65));
  local('tail-tip','cream',1.1,tailSection(.75));
  local('tail-tip-shade','cream',1.12,tailSection(.75,1,-.98,-.40));

  // A shallow back, fuller haunch and tucked waist carry the profile. Deliberate
  // contour tufts are few enough to survive the 80-column solo rasterizer.
  local('torso','fur',2,[{x:-.435,y:-.36},{x:-.43,y:-.425},{x:-.38,y:-.488-breath},
    {x:-.29,y:-.515-breath},{x:-.18,y:-.505-breath},{x:-.10,y:-.515-breath},
    {x:.02,y:-.498-breath},{x:.13,y:-.50-breath},{x:.22,y:-.45},{x:.285,y:-.355},
    {x:.25,y:-.265},{x:.16,y:-.216},{x:.04,y:-.225},{x:-.08,y:-.26},
    {x:-.20,y:-.257},{x:-.28,y:-.225},{x:-.365,y:-.23},{x:-.41,y:-.28}]);
  local('back-guard','shadow',2.04,[{x:-.42,y:-.43},{x:-.34,y:-.49-breath},
    {x:-.23,y:-.50-breath},{x:-.12,y:-.492-breath},{x:.04,y:-.485-breath},{x:.18,y:-.46},
    {x:.16,y:-.419},{x:.08,y:-.428},{x:.025,y:-.407},{x:-.06,y:-.425},
    {x:-.12,y:-.40},{x:-.20,y:-.42},{x:-.28,y:-.392},{x:-.36,y:-.41}]);
  local('flank-light','fur',2.08,[{x:-.32,y:-.405},{x:-.22,y:-.425},{x:-.08,y:-.418},
    {x:.06,y:-.405},{x:.15,y:-.355},{x:.105,y:-.285},{x:.015,y:-.275},
    {x:-.11,y:-.297},{x:-.23,y:-.287},{x:-.32,y:-.32}]);
  local('belly-undercoat','cream',2.12,[{x:-.23,y:-.282},{x:-.08,y:-.278},{x:.03,y:-.255},
    {x:.18,y:-.246},{x:.14,y:-.218},{x:.035,y:-.225},{x:-.08,y:-.26},{x:-.20,y:-.257}]);
  local('haunch-ruff','fur',2.16,[{x:-.38,y:-.43},{x:-.29,y:-.40},{x:-.255,y:-.34},
    {x:-.265,y:-.28},{x:-.30,y:-.24},{x:-.32,y:-.28},{x:-.35,y:-.25},
    {x:-.38,y:-.29},{x:-.405,y:-.285},{x:-.414,y:-.36}]);
  // Angular neck and chest preserve a canid shoulder rather than a floating head.
  local('neck','fur',2.2,[{x:.08,y:-.30},{x:.19,y:-.51},{x:.29,y:-.59},{x:.41,y:-.41},{x:.24,y:-.22}]);
  local('shoulder-guard','shadow',2.3,[{x:.11,y:-.40},{x:.18,y:-.49},{x:.25,y:-.54},
    {x:.285,y:-.46},{x:.235,y:-.38},{x:.245,y:-.32},{x:.195,y:-.35},{x:.17,y:-.30}]);
  local('chest','cream',2.4,[{x:.245,y:-.43},{x:.37,y:-.36},{x:.28,y:-.27},
    {x:.27,y:-.22},{x:.23,y:-.235},{x:.215,y:-.18},{x:.19,y:-.205},
    {x:.18,y:-.16},{x:.16,y:-.25},{x:.17,y:-.33}]);
  local('ear-far','fur',2.8,[{x:.165,y:-.55},{x:.18,y:-.755},{x:.315,y:-.60}],true);
  local('ear-far-inner','shadow',2.9,[{x:.195,y:-.59},{x:.195,y:-.705},{x:.275,y:-.61}],true);
  local('head','fur',3,[{x:.18,y:-.42},{x:.205,y:-.59},{x:.30,y:-.635},{x:.405,y:-.58},
    {x:.46,y:-.48},{x:.44,y:-.36},{x:.31,y:-.31},{x:.23,y:-.35}],true);
  local('ear-near','fur',3.1,[{x:.30,y:-.55},{x:.385,y:-.79},{x:.45,y:-.52}],true);
  local('ear-near-inner','shadow',3.2,[{x:.335,y:-.58},{x:.382,y:-.737},{x:.415,y:-.55}],true);
  local('muzzle','fur',3.3,[{x:.35,y:-.51},{x:.50,y:-.47},{x:.675,y:-.403},
    {x:.615,y:-.35},{x:.44,y:-.32},{x:.30,y:-.39}],true);
  // Keep the cream cheek behind the tip: a continuous wedge, not two light bars.
  local('cheek','cream',3.4,[{x:.285,y:-.44},{x:.44,y:-.415},{x:.56,y:-.385},
    {x:.49,y:-.35},{x:.37,y:-.32},{x:.28,y:-.36}],true);
  local('brow-light','fur',3.5,[{x:.28,y:-.59},{x:.35,y:-.585},{x:.435,y:-.515},
    {x:.41,y:-.492},{x:.36,y:-.52},{x:.285,y:-.545}],true);
  local('nose','ink',5,ellipse(.65,-.395,.027,.027,8),true);
  local('eye','ink',5,ellipse(.389,-.511,.018,.021,8),true);
  const all=polygons.flatMap(p=>p.points);
  if(polygons.length>FOX_LIMITS.maxPolygons||all.length>FOX_LIMITS.maxVertices)throw new RangeError('Fox geometry exceeds declared budget');
  for(const p of all)if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new RangeError('Non-finite fox geometry');
  return {species:'fox',tick:state.tick,phase:b.kind,root:{x:state.rootX,y:bodyY},polygons,legs,
    landmarks:{muzzle:point(.65,-.395,true),earNear:point(earPoint({x:.385,y:-.79},true).x,earPoint({x:.385,y:-.79},true).y,true),earFar:point(earPoint({x:.18,y:-.755},false).x,earPoint({x:.18,y:-.755},false).y,true),
      tailRoot:point(a.x,a.y),tailTip:point(d.x,d.y)},
    bounds:{minX:Math.min(...all.map(p=>p.x)),maxX:Math.max(...all.map(p=>p.x)),
      minY:Math.min(...all.map(p=>p.y)),maxY:Math.max(...all.map(p=>p.y))}};
}
