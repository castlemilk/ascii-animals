/** Original side-profile construction. No image, sprite, ASCII drawing or ray geometry. */
import type { FoxFoot, FoxLeg, FoxLegId, FoxMaterial, FoxOptions, FoxPoint, FoxPolygon, FoxPose, FoxState } from './types.js';
import { FOX_LIMITS, clamp, smooth } from './config.js';

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
export function poseFox(state:FoxState, liveOptions:FoxOptions):FoxPose {
  const b=state.behavior, options='plan' in b?b.plan.options:liveOptions;
  const sign=options.facing==='right'?1:-1, scale=options.scale;
  let lift=0,compression=0,tailBalance=0,air=0,land=1,crouch=0;
  if(b.kind==='crouch') {crouch=smooth(b.age/(options.crouchTicks-1));compression=.085*crouch;tailBalance=-.14*crouch;}
  if(b.kind==='airborne') {
    air=b.age/options.airTicks;lift=-4*options.pounceHeight*air*(1-air);
    compression=.085*(1-smooth(air/.18));tailBalance=-.14*Math.cos(Math.PI*air);
  }
  if(b.kind==='landing') {
    land=smooth(b.age/(options.landingTicks-1));compression=.045*Math.sin(Math.PI*land);tailBalance=.14*(1-land);
  }
  const calm=!['crouch','airborne','landing'].includes(b.kind);
  const breath=calm?Math.sin(state.breathPhase)*options.breathing:0;
  const bodyY=lift+compression;
  const headDip=b.kind==='sniff'? options.sniffDepth*(.62+.22*Math.sin(state.breathPhase*2)+.16*state.target.y)
    :b.kind==='stalk'?options.sniffDepth*.35:0;
  const point=(x:number,y:number,head=false):FoxPoint=>({x:state.rootX+sign*x*scale,
    y:FOX_LIMITS.groundY+(y+(head?headDip:0))*scale+bodyY});
  const polygons:FoxPolygon[]=[],legs:FoxLeg[]=[];
  const add=(id:string,material:FoxMaterial,depth:number,points:readonly FoxPoint[]):void=>{polygons.push({id,material,depth,points});};
  const local=(id:string,material:FoxMaterial,depth:number,points:readonly FoxPoint[],head=false):void=>{
    add(id,material,depth,points.map(p=>point(p.x,p.y,head)));};
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
    const root=point(fore?(near?.21:.12):(near?-.31:-.40),fore?-.30:-.32);
    const knee={x:root.x+sign*(fore?-.025:.105)*scale+(foot.x-rest.x)*.3,
      y:FOX_LIMITS.groundY-(fore?.15:.17)*scale+bodyY*.6+(foot.y-FOX_LIMITS.groundY)*.4};
    const hock={x:foot.x-sign*.04*scale,y:FOX_LIMITS.groundY-.065*scale+(foot.y-FOX_LIMITS.groundY)*.8+bodyY*.15};
    const joints=fore?[root,knee,foot]:[root,knee,hock,foot];
    legs.push({id,joints,planted});
    const depth=near?4:0;
    for(let j=0;j<joints.length-1;j++)add(`${id}-bone-${j}`,near?(j===0?'fur':'shadow'):'shadow',depth,
      bone(joints[j]!,joints[j+1]!,scale*(j===0?.044:.027),scale*.023));
    add(`${id}-paw`,'shadow',depth+.05,[{x:foot.x-sign*.026*scale,y:foot.y-.025*scale},
      {x:foot.x+sign*.064*scale,y:foot.y-.02*scale},{x:foot.x+sign*.066*scale,y:foot.y+.012*scale},
      {x:foot.x-sign*.029*scale,y:foot.y+.012*scale}]);
  }

  // A bushy tapered curve, with width measured normal to its tangent.
  const sway=Math.sin(state.tailPhase)*options.tailSway;
  const a={x:-.39,y:-.38},bb={x:-.59,y:-.29},c={x:-.82,y:-.34+sway*.6},d={x:-1.0,y:-.54+sway+tailBalance};
  const tailSection=(start:number):FoxPoint[]=>{
    const left:FoxPoint[]=[],right:FoxPoint[]=[];
    for(let i=0;i<=16;i++) {
      const t=start+(1-start)*i/16,p=cubic(a,bb,c,d,t);
      const prev=cubic(a,bb,c,d,Math.max(0,t-.001)),next=cubic(a,bb,c,d,Math.min(1,t+.001));
      const len=Math.hypot(next.x-prev.x,next.y-prev.y)||1;
      const width=.045*(1-t)+.13*Math.pow(Math.sin(Math.PI*t),.8);
      const nx=-(next.y-prev.y)/len,ny=(next.x-prev.x)/len;
      left.push({x:p.x+nx*width,y:p.y+ny*width});right.push({x:p.x-nx*width,y:p.y-ny*width});
    }
    return [...left,...right.reverse()];
  };
  local('tail','fur',1,tailSection(0));local('tail-tip','cream',1.1,tailSection(.71));

  local('torso','fur',2,ellipse(-.075,-.365,.355,.15+breath));
  // Angular neck and chest preserve a canid shoulder rather than a floating head.
  local('neck','fur',2.2,[{x:.08,y:-.30},{x:.19,y:-.51},{x:.29,y:-.59},{x:.41,y:-.41},{x:.24,y:-.22}]);
  local('chest','cream',2.4,[{x:.245,y:-.43},{x:.37,y:-.36},{x:.25,y:-.23},{x:.18,y:-.16},{x:.17,y:-.33}]);
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
  local('nose','ink',5,ellipse(.65,-.395,.027,.027,8),true);
  local('eye','ink',5,ellipse(.389,-.511,.018,.021,8),true);
  const all=polygons.flatMap(p=>p.points);
  if(polygons.length>FOX_LIMITS.maxPolygons||all.length>FOX_LIMITS.maxVertices)throw new RangeError('Fox geometry exceeds declared budget');
  for(const p of all)if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new RangeError('Non-finite fox geometry');
  return {species:'fox',tick:state.tick,phase:b.kind,root:{x:state.rootX,y:bodyY},polygons,legs,
    landmarks:{muzzle:point(.65,-.395,true),earNear:point(.385,-.79,true),earFar:point(.18,-.755,true),
      tailRoot:point(a.x,a.y),tailTip:point(d.x,d.y)},
    bounds:{minX:Math.min(...all.map(p=>p.x)),maxX:Math.max(...all.map(p=>p.x)),
      minY:Math.min(...all.map(p=>p.y)),maxY:Math.max(...all.map(p=>p.y))}};
}
