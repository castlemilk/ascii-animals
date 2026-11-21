/** Private Ember variation. Original geometry and defaults are intentionally unchanged.
 * Authored proposal recovered from fox-cartoon.patch SHA-256
 * 834209eed51987b4ae23ccf990c32ca2d10c0ce9ad35f652f3ee9e705aea6aae.
 */
/** Ember: original angular cartoon construction, sampled as editable ASCII cells. */
import type { FoxFoot, FoxLeg, FoxLegId, FoxMaterial, FoxOptions, FoxPoint, FoxPolygon, FoxPose, FoxState } from '../../../lib/types.js';
import { FOX_LIMITS, clamp, smooth } from '../../../lib/config.js';
import type { FoxExpression } from '../../../lib/director-types.js';

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
  if(b.kind==='crouch') {crouch=smooth(b.age/(options.crouchTicks-1));compression=.115*crouch;tailBalance=-.14*crouch;}
  if(b.kind==='airborne') {
    air=b.age/options.airTicks;lift=-4*options.pounceHeight*air*(1-air);
    compression=.115*(1-smooth(air/.18));tailBalance=-.14*Math.cos(Math.PI*air);
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
  const load=b.kind==='airborne'?1-smooth(air/.18):crouch;
  // Solo gallery poses now have the same vocabulary as directed scenes. These
  // offsets are pure functions of existing fixed-tick state: no second clock,
  // randomness, stored renderer state or new public options.
  const localMotion=clamp(options.breathing/.009,0,1);
  const moving=clamp(Math.abs(state.velocityX)/options.stalkSpeed,0,1);
  const attention=state.target.active?.28+.72*moving:moving;
  const headPitch=clamp((expression?.headPitch??(-.045+Math.sin(state.breathPhase)*.055*localMotion
    +state.target.y*.16*attention))*1.6+.24*load
    +(b.kind==='airborne'?-.20*Math.sin(Math.PI*air)+.12*air:0),-.46,.46);
  const earNear=clamp((expression?.earNear??(.08+Math.sin(state.tailPhase+.8)*.12*localMotion
    -.25*attention))*1.9-.28*load,-.65,.65);
  const earFar=clamp((expression?.earFar??(-.16+Math.sin(state.breathPhase+.9)*.11*localMotion
    +.18*attention))*1.9+.18*load,-.65,.65);
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
    if(head){const dx=x-.22,dy=y+.44;
      x=.22+dx*Math.cos(headPitch)-dy*Math.sin(headPitch);y=-.44+dx*Math.sin(headPitch)+dy*Math.cos(headPitch);}
    return {x:state.rootX+sign*x*scale,
      y:FOX_LIMITS.groundY+(y*(1-restAmount*.18)+(head?headDip:0)
        +bowAmount*.075*clamp(x+.25,0,.8)+x*shoulderLoad*.018)*scale+bodyY};
  };
  const earPoint=(p:FoxPoint,near:boolean):FoxPoint=>{
    const angle=near?earNear:earFar;
    if(!angle)return p;const cx=near?.405:.18,cy=-.65,dx=p.x-cx,dy=p.y-cy;
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
  const stream=b.kind==='airborne'?Math.sin(Math.PI*air):moving*.35;
  const a={x:-.39,y:-.38},bb={x:-.69,y:-.20-restAmount*.06},
    c={x:-1.04+restAmount*.45,y:-.71+sway*.45+tailLift*.55+stream*.36},
    d={x:-.77-stream*.22+restAmount*.72,y:-.76+sway*.7+tailBalance+tailLift*.9+stream*.42+restAmount*.35};
  // Each ribbon uses exactly the same moving centerline and tangent. Coat
  // layers therefore bend with the brush instead of sliding across its cells.
  const tailSection=(start:number,end=1,lower=-1,upper=1):FoxPoint[]=>{
    const left:FoxPoint[]=[],right:FoxPoint[]=[];
    for(let i=0;i<=16;i++) {
      const t=start+(end-start)*i/16,p=cubic(a,bb,c,d,t);
      const prev=cubic(a,bb,c,d,Math.max(0,t-.001)),next=cubic(a,bb,c,d,Math.min(1,t+.001));
      const len=Math.hypot(next.x-prev.x,next.y-prev.y)||1;
      const width=t===1?0:(.047*(1-t)+.164*Math.pow(Math.sin(Math.PI*t),.85));
      const nx=-(next.y-prev.y)/len,ny=(next.x-prev.x)/len;
      left.push({x:p.x+nx*width*upper,y:p.y+ny*width*upper});
      right.push({x:p.x+nx*width*lower,y:p.y+ny*width*lower});
    }
    return [...left,...right.reverse()];
  };
  local('tail','fur',1,tailSection(0));
  local('tail-dorsal','shadow',1.02,tailSection(.08,.76,.45,.98));
  local('tail-tip','cream',1.1,tailSection(.66));
  local('tail-tip-shade','cream',1.12,tailSection(.66,1,-.98,-.63));

  // Three broad masses: compact torso, oversize cheek wedge, hooked brush.
  // Detail is spent on the face, not on guard-hair noise.
  local('torso','fur',2,[{x:-.44,y:-.35},{x:-.40,y:-.48-breath},
    {x:-.29,y:-.535-breath},{x:-.10,y:-.51-breath},{x:.13,y:-.50-breath},
    {x:.26,y:-.38},{x:.23,y:-.24},{x:.04,y:-.235},{x:-.15,y:-.28},
    {x:-.33,y:-.23},{x:-.42,y:-.28}]);
  local('back-guard','shadow',2.04,[{x:-.40,y:-.47},{x:-.29,y:-.535-breath},
    {x:-.10,y:-.51-breath},{x:.13,y:-.50-breath},{x:.18,y:-.44},
    {x:-.06,y:-.44},{x:-.25,y:-.46}]);
  local('flank-light','fur',2.08,[{x:-.32,y:-.43},{x:-.12,y:-.44},
    {x:.10,y:-.41},{x:.14,y:-.30},{x:-.12,y:-.32},{x:-.30,y:-.28}]);
  local('neck','fur',2.2,[{x:.07,y:-.29},{x:.12,y:-.57},{x:.25,y:-.66},
    {x:.42,y:-.44},{x:.25,y:-.23}]);
  local('chest','cream',2.4,[{x:.17,y:-.49},{x:.38,y:-.40},{x:.28,y:-.26},
    {x:.23,y:-.16},{x:.19,y:-.22},{x:.12,y:-.19},{x:.13,y:-.34}]);
  // Ears have independent pivots. All head parts then share the neck pivot.
  local('ear-far','fur',2.8,[{x:.08,y:-.60},{x:.12,y:-1.02},{x:.29,y:-.66}],true);
  local('ear-far-inner','shadow',2.9,[{x:.12,y:-.67},{x:.14,y:-.94},{x:.24,y:-.69}],true);
  local('head','fur',3,[{x:.06,y:-.45},{x:.15,y:-.68},{x:.31,y:-.75},
    {x:.49,y:-.65},{x:.57,y:-.50},{x:.48,y:-.33},{x:.28,y:-.27}],true);
  local('ear-near','fur',3.1,[{x:.28,y:-.63},{x:.44,y:-1.065},{x:.53,y:-.58}],true);
  local('ear-near-inner','shadow',3.2,[{x:.34,y:-.66},{x:.445,y:-.965},{x:.48,y:-.63}],true);
  local('muzzle','fur',3.3,[{x:.35,y:-.54},{x:.55,y:-.50},{x:.78,y:-.43},
    {x:.68,y:-.36},{x:.43,y:-.29},{x:.22,y:-.39}],true);
  local('cheek','cream',3.4,[{x:.10,y:-.43},{x:.34,y:-.48},{x:.55,y:-.435},
    {x:.75,y:-.41},{x:.62,y:-.36},{x:.39,y:-.29},{x:.30,y:-.23},
    {x:.23,y:-.34}],true);
  local('brow-light','fur',3.5,[{x:.28,y:-.68},{x:.40,y:-.67},
    {x:.50,y:-.57},{x:.42,y:-.545},{x:.31,y:-.60}],true);
  // Large white eye, a single dark pupil, and a clean slanted brow survive 80x32.
  const eyeY=-.565,focus=load+(b.kind==='airborne'?.6*Math.sin(Math.PI*air):0),sleep=restAmount>.65;
  local('eye-white','cream',4.9,[{x:.33,y:eyeY-.032},{x:.485,y:eyeY-.018},
    {x:.465,y:eyeY+.038},{x:.39,y:eyeY+.045}],true);
  local(sleep?'eye-closed':'eye','ink',5.4,ellipse(.44,eyeY+.009,.024,sleep?.004:.024,8),true);
  local('brow','ink',5.1,[{x:.32,y:eyeY-.055-focus*.008},
    {x:.49,y:eyeY-.026+focus*.018},{x:.485,y:eyeY-.006+focus*.018},
    {x:.325,y:eyeY-.034-focus*.008}],true);
  local('smile','ink',5.1,[{x:.40,y:-.374},{x:.61,y:-.386},
    {x:.54,y:-.36},{x:.43,y:-.35}],true);
  local('nose','ink',5.2,ellipse(.764,-.423,.028,.021,8),true);
  const all=polygons.flatMap(p=>p.points);
  if(polygons.length>FOX_LIMITS.maxPolygons||all.length>FOX_LIMITS.maxVertices)throw new RangeError('Fox geometry exceeds declared budget');
  for(const p of all)if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new RangeError('Non-finite fox geometry');
  return {species:'fox',tick:state.tick,phase:b.kind,root:{x:state.rootX,y:bodyY},polygons,legs,
    landmarks:{muzzle:point(.764,-.423,true),earNear:point(earPoint({x:.44,y:-1.065},true).x,earPoint({x:.44,y:-1.065},true).y,true),earFar:point(earPoint({x:.12,y:-1.02},false).x,earPoint({x:.12,y:-1.02},false).y,true),
      tailRoot:point(a.x,a.y),tailTip:point(d.x,d.y)},
    bounds:{minX:Math.min(...all.map(p=>p.x)),maxX:Math.max(...all.map(p=>p.x)),
      minY:Math.min(...all.map(p=>p.y)),maxY:Math.max(...all.map(p=>p.y))}};
}
