/** Private Mica surface; canonical anatomy remains the contact authority. */
import { GECKO_LIMITS, transformGeckoPoint } from '../../../compiled/gecko.js';
import { getGeckoAnatomy } from '../../../compiled/geometry.js';
import type { GeckoGeometryResult, GeckoMaterial, GeckoPart, GeckoSample, GeckoState, Vec2 } from '../../../compiled/types.js';

const clamp=(v:number,a:number,b:number):number=>Math.max(a,Math.min(b,v));
const TAU=Math.PI*2;

/** Local expression only. Feet always come from the model's wall contacts. */
export interface GeckoSurfacePose {
  readonly headTurn?:number;
  readonly headReach?:number;
  readonly crouch?:number;
  readonly jawOpen?:number;
  /** Eye aim is local to the skull; it never changes a wall contact. */
  readonly gaze?:number;
}

/**
 * Bounded surface samples. This knows no camera, cell grid, Canvas or host clock.
 * Material names are gecko-local; the proposed writer adapter maps them explicitly.
 */
export function sampleGecko(state: GeckoState, emit: (sample: GeckoSample)=>void, pose:GeckoSurfacePose={}): GeckoGeometryResult {
  if(typeof emit!=='function')throw new TypeError('emit must be a function');
  const headTurn=clamp(pose.headTurn??0,-.48,.48),headReach=clamp(pose.headReach??0,-.060,.065);
  const crouch=clamp(pose.crouch??0,0,1),jawOpen=clamp(pose.jawOpen??0,0,1);
  const gaze=clamp(pose.gaze??headTurn,-1,1);
  if(![headTurn,headReach,crouch,jawOpen,gaze].every(Number.isFinite))throw new TypeError('Expected finite Gecko expression');
  const anatomy=getGeckoAnatomy(state);
  let count=0;
  const put=(p:Vec2,z:number,tone:number,material:GeckoMaterial,part:GeckoPart):void=>{
    if(++count>GECKO_LIMITS.samples)throw new RangeError('Gecko sample capacity exceeded');
    if(![p.x,p.y,z,tone].every(Number.isFinite))throw new TypeError('Non-finite gecko sample');
    emit({x:p.x,y:p.y,z,tone:clamp(tone,0,1),material,part,stableId:count-1});
  };
  const disk=(center:Vec2,rx:number,ry:number,angle:number,rings:number,z:number,material:GeckoMaterial,part:GeckoPart,tone=.7,head=false):void=>{
    const c=Math.cos(angle),s=Math.sin(angle);
    for(let ir=0;ir<=rings;ir++) {
      const radius=ir/rings,steps=ir===0?1:ir*8;
      for(let j=0;j<steps;j++) {
        const theta=j/steps*TAU,u=Math.cos(theta)*radius,v=Math.sin(theta)*radius;
        // A broad cheek and a short blunt snout survive a coarse character grid.
        const lx=u*rx,ly=v*ry*(head?(1-.32*Math.max(0,u)):1);
        const p={x:center.x+lx*c-ly*s,y:center.y+lx*s+ly*c};
        const dome=Math.sqrt(Math.max(0,1-radius*radius));
        // Three deliberately placed islands replace the old mottled texture.
        // Their attachment is anatomical, so no screen-space shimmer is added.
        const spot=material==='skin'&&part==='body'&&
          (Math.hypot((u+.44)*1.7,(v+.22)*2.1)<.22||Math.hypot((u+.03)*1.8,(v-.15)*2.1)<.20||Math.hypot((u-.38)*1.9,(v+.17)*2.1)<.18);
        const value=spot?.30:tone+(v<-.14?.10:0)+(dome>.72?.03:0);
        put(p,z+dome*(material==='skin'?.055:.012),value,material,part);
      }
    }
  };
  const strip=(a:Vec2,b:Vec2,ra:number,rb:number,segments:number,widthSamples:number,z:number,part:GeckoPart):void=>{
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),nx=length>0?-dy/length:0,ny=length>0?dx/length:1;
    for(let i=0;i<=segments;i++) {
      const t=i/segments,r=ra+(rb-ra)*t;
      for(let j=0;j<widthSamples;j++) {
        const v=j/(widthSamples-1)*2-1;
        put({x:a.x+dx*t+nx*r*v,y:a.y+dy*t+ny*r*v},z+.018*(1-v*v),.67,'skin',part);
      }
    }
  };
  // The tail begins at the pelvis every frame; there is never a detached curve.
  for(let i=0;i<anatomy.tail.length;i++) {
    const p=anatomy.tail[i]!,prev=anatomy.tail[Math.max(0,i-1)]!,next=anatomy.tail[Math.min(anatomy.tail.length-1,i+1)]!;
    const dx=next.x-prev.x,dy=next.y-prev.y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
    for(let j=0;j<9;j++) {
      const v=j/4-1;
      put({x:p.x+nx*p.radius*v,y:p.y+ny*p.radius*v},.018+.025*(1-v*v),v<-.25?.80:.64,'skin','tail');
    }
  }
  // Raised swing feet are sampled above stance feet; all remain joint-connected.
  for(const limb of anatomy.limbs) {
    strip(limb.shoulder,limb.elbow,.047,.032,15,5,.026+limb.lift*.3,'limb');
    strip(limb.elbow,limb.palm,.032,.021,15,5,.024+limb.lift*.7,'limb');
    disk(limb.palm,.034,.031,limb.angle,4,.025+limb.lift,'skin','limb',.71);
    for(const pad of limb.pads) {
      const angle=Math.atan2(pad.y-limb.palm.y,pad.x-limb.palm.x);
      const knuckle={x:limb.palm.x+(pad.x-limb.palm.x)*.55,y:limb.palm.y+(pad.y-limb.palm.y)*.55};
      strip(limb.palm,knuckle,.010,.008,6,3,.025+limb.lift,'digit');
      strip(knuckle,pad,.008,.007,7,3,.027+limb.lift,'digit');
      disk(pad,.029,.017,angle,4,.034+limb.lift,'pad','pad',.92);
    }
  }
  const breathing=1+state.options.breathing*Math.sin(state.phase*1.45);
  // The torso gathers between the unchanged shoulder contacts. The visible
  // compression is intentionally cartoonish; the contact solver is untouched.
  disk(state.position,.285-.048*crouch,(.137+.038*crouch)*breathing,state.heading,17,.061-.012*crouch,'skin','body',.68);
  const neck=transformGeckoPoint(state.position,state.heading,.19-.025*crouch,0),faceHeading=state.heading+headTurn;
  disk(neck,.128,.102,state.heading,9,.068,'skin','neck',.75);
  const face=transformGeckoPoint(neck,faceHeading,.118+headReach,0);
  disk(face,.245,.229+.012*crouch,faceHeading,18,.076,'skin','head',.78,true);
  // The mouth seam is always sampled; the same attached seam opens for a snap.
  // It remains near the director's existing .55-unit jaw-contact probe.
  const mouth=transformGeckoPoint(face,faceHeading,.198,0);
  disk(mouth,.011+.038*jawOpen,.090+.016*jawOpen,faceHeading,5,.164,'pupil','head',.18);
  const lip=transformGeckoPoint(face,faceHeading,.224+.032*jawOpen,0);
  disk(lip,.019,.096,faceHeading,4,.176,'skin','head',.89);
  for(const side of [-1,1]) {
    const eye=transformGeckoPoint(face,faceHeading,.085,side*.170);
    // Gold lidless eyes. Character comes from aim and head posture, not blinking.
    disk(eye,.104,.096,faceHeading,8,.154,'eye','eye',.96);
    const pupil=transformGeckoPoint(eye,faceHeading,.016+.012*jawOpen,gaze*.023);
    disk(pupil,.020,.061,faceHeading,4,.185,'pupil','eye',.12);
    const nostril=transformGeckoPoint(face,faceHeading,.183,side*.056);
    disk(nostril,.010,.009,faceHeading,2,.177,'pupil','head',.25);
  }
  return {samples:count,capacity:GECKO_LIMITS.samples};
}
