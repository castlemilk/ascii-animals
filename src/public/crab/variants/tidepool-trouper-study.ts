/**
 * Private choreography for the single-crab study. The public facade still owns
 * validation, integer ticks and the legacy notice / defend / settle contract.
 * There are no clocks, browser reads, random calls or scheduled callbacks here.
 */
export interface CrabStudyOptions {
  readonly columns:number; readonly rows:number; readonly seed:number;
  readonly speed:number; readonly scale:number; readonly sway:number;
  readonly facing:'left'|'right'; readonly behavior:'scuttle'|'curious'|'guard';
  readonly scene?:string;
}

export type CrabStudyAction = 'forage'|'signal'|'shelter';
export type CrabStudyStage = 'idle'|'notice'|'defend'|'settle';
export interface CrabStudyFoot {
  readonly x:number; readonly y:number; readonly planted:boolean; readonly lift:number;
}
export interface CrabStudyPose {
  readonly x:number; readonly y:number;
  /** Claw values refer to physical left and right, before renderer mirroring. */
  readonly left:number; readonly right:number;
  readonly leftReach:number; readonly rightReach:number;
  readonly leftOpen:number; readonly rightOpen:number;
  readonly gazeX:number; readonly gazeY:number; readonly crouch:number; readonly lean:number;
  /** Four physical left feet, then four physical right feet; all in world space. */
  readonly feet:readonly CrabStudyFoot[];
  readonly action:CrabStudyAction|null; readonly age:number; readonly stage:CrabStudyStage;
  readonly targetX:number; readonly targetY:number; readonly lead:-1|1; readonly poster:boolean;
}

const clamp=(value:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,value));
const smooth=(value:number)=>{const p=clamp(value,0,1);return p*p*(3-2*p);};
const mix=(from:number,to:number,progress:number)=>from+(to-from)*progress;
const ACTION_TICKS=180;

/** Share this fit with the painter, so foot contacts and the silhouette agree. */
export function studyLayout(options:CrabStudyOptions) {
  const ratio=options.columns*.56/options.rows;
  // Give the face room on a phone without consuming the grounded stride lane.
  // Width and height caps retain space for both the lead claw and a real step.
  const radius=Math.min(.30*options.scale,.38/ratio,.32);
  return Object.freeze({radius,yScale:radius*ratio,ratio,y:.12,xLimit:Math.max(0,.94-2.5*radius)});
}

interface MovingFoot {
  x:number;y:number;planted:boolean;lift:number;
  fromX:number;fromY:number;toX:number;toY:number;progress:number;
}
interface Action {
  kind:CrabStudyAction;start:number;originX:number;targetX:number;targetY:number;
  lead:-1|1;poster:boolean;
}

export function createCrabStudy(options:()=>CrabStudyOptions,tick:()=>number) {
  let x=0,gazeX=0,gazeY=0,startedAt=tick();
  let guideActive=false,guideX=0,guideY=0;
  let action:Action|null=null;
  let feet:MovingFoot[]=[];
  let swingingGroup:0|1|null=null,nextGroup:0|1=0,swingTicks=12;

  const direction=():-1|1=>options().facing==='left'?-1:1;
  const age=()=>action===null?0:Math.max(0,tick()-action.start);
  const stage=():CrabStudyStage=>action===null?'idle':age()<45?'notice':age()<110?'defend':'settle';
  // Diagonal groups have two contacts on each side. At most one group swings.
  const group=(index:number):0|1=>((index%2+(index<4?0:1))%2) as 0|1;
  function offset(index:number):readonly[number,number] {
    const layout=studyLayout(options()),side=index<4?-1:1,j=index%4;
    return [side*(1.85-j*.10)*layout.radius,(-.05+j*.32)*layout.yScale];
  }
  function plant() {
    const layout=studyLayout(options());
    feet=Array.from({length:8},(_,index)=>{
      const [dx,dy]=offset(index),fx=x+dx,fy=layout.y+dy;
      return {x:fx,y:fy,planted:true,lift:0,fromX:fx,fromY:fy,toX:fx,toY:fy,progress:1};
    });
    swingingGroup=null;nextGroup=0;
  }
  function rootAt(at:number) {
    if(action===null||action.kind!=='forage')return x;
    // A held anticipation precedes travel. The last travel tick is 109, leaving
    // seventy settling ticks to finish recovery steps without sliding contacts.
    return mix(action.originX,action.targetX,smooth((at-45)/64));
  }
  function faceTarget() {
    const tx=action?.targetX??(guideActive?guideX:x),ty=action?.targetY??(guideActive?guideY:studyLayout(options()).y);
    const interest=options().behavior==='curious'?4:3;
    return [clamp((tx-x)*interest,-1,1),clamp((ty-studyLayout(options()).y)*2,-1,1)] as const;
  }
  function moveFeet(previousX:number) {
    const layout=studyLayout(options());
    // Complete an airborne step even after travel stops or the action ends.
    // Planted feet are never rewritten by a moving body.
    if(swingingGroup!==null) {
      let complete=true;
      for(let index=0;index<feet.length;index++) {
        if(group(index)!==swingingGroup)continue;
        const foot=feet[index]!;
        foot.progress=Math.min(1,foot.progress+1/swingTicks+1e-12);
        const p=smooth(foot.progress);
        foot.x=mix(foot.fromX,foot.toX,p);foot.y=mix(foot.fromY,foot.toY,p);
        foot.lift=Math.sin(Math.PI*foot.progress)*layout.yScale*.16;
        if(foot.progress>=1) {foot.x=foot.toX;foot.y=foot.toY;foot.lift=0;foot.planted=true;}
        else complete=false;
      }
      if(complete)swingingGroup=null;
    }
    if(swingingGroup!==null)return;

    const travelling=Math.abs(x-previousX)>1e-8;
    // At low speed use fewer, longer steps, while retaining the public 180-tick
    // response duration. This bound leaves enough settling time at every speed.
    const duration=Math.round(clamp(12/Math.sqrt(options().speed),8,18));
    const landingX=travelling?rootAt(age()+duration):x;
    const needsStep=(candidate:0|1)=>feet.some((foot,index)=>{
      if(group(index)!==candidate)return false;
      const [dx,dy]=offset(index);
      return Math.abs(foot.x-(landingX+dx))>layout.radius*.025||Math.abs(foot.y-(layout.y+dy))>layout.yScale*.025;
    });
    let chosen:0|1=nextGroup;
    if(!needsStep(chosen)) {chosen=chosen===0?1:0;if(!needsStep(chosen))return;}
    swingingGroup=chosen;nextGroup=chosen===0?1:0;swingTicks=duration;
    for(let index=0;index<feet.length;index++) {
      if(group(index)!==chosen)continue;
      const foot=feet[index]!,[dx,dy]=offset(index);
      foot.fromX=foot.x;foot.fromY=foot.y;foot.toX=landingX+dx;foot.toY=layout.y+dy;
      foot.progress=0;foot.lift=0;foot.planted=false;
    }
  }
  function cue(kind:CrabStudyAction,poster=false):boolean {
    if(!['forage','signal','shelter'].includes(kind))throw new TypeError('Unknown crab study cue');
    // A deliberate still is replaceable. A live gesture is atomic: rapid taps
    // neither restart its anticipation nor append work to an event queue.
    if(action!==null&&!action.poster&&!poster)return false;
    const layout=studyLayout(options());
    let target=guideActive?guideX:x+direction()*.30;
    // One invitation asks for a readable, grounded stride. A full-stage jump at
    // minimum scale would force planted legs to stretch several body widths or
    // recovery toes to teleport. Capture the reachable destination up front.
    if(kind==='forage')target=clamp(clamp(target,x-layout.radius*1.5,x+layout.radius*1.5),-layout.xLimit,layout.xLimit);
    else target=clamp(target,-.94,.94);
    if(kind==='forage'&&!guideActive&&Math.abs(target-x)<.02)target=clamp(x-direction()*Math.min(.30,layout.radius*1.5),-layout.xLimit,layout.xLimit);
    const lead=(Math.sign(target-x)||direction()) as -1|1;
    action={kind,start:tick()-(poster?90:0),originX:x,targetX:target,
      targetY:guideActive?guideY:layout.y,lead,poster};
    if(poster) {x=rootAt(90);plant();}
    const [gx,gy]=faceTarget();gazeX=gx;gazeY=gy;
    return true;
  }
  function reset() {
    x=0;gazeX=gazeY=0;startedAt=tick();guideActive=false;guideX=guideY=0;action=null;plant();
  }
  function snapshot():CrabStudyPose {
    const o=options(),layout=studyLayout(o),elapsed=age();
    const idle=(tick()-startedAt)/60*o.speed+(o.seed%997)/997*Math.PI*2;
    const guard=o.behavior==='guard';
    const interest=o.behavior==='curious'&&guideActive?.10:0;
    const neutralLeft=guard?.80:.17+Math.sin(idle*.7)*.025+interest;
    const neutralRight=guard?.65:.10+Math.sin(idle*.7+.8)*.018+interest*.5;
    let left=neutralLeft,right=neutralRight,leftReach=0,rightReach=0;
    // Sway now shifts weight over planted feet rather than translating contacts.
    let leftOpen=guard?.72:.30,rightOpen=guard?.56:.22,crouch=0,lean=guard?0:Math.sin(idle*.65)*o.sway*.24;
    if(action!==null) {
      const lead=action.lead;
      if(action.kind==='forage') {
        const prepare=smooth(elapsed/23),release=smooth((elapsed-45)/20),settle=1-smooth((elapsed-110)/30);
        const travelling=elapsed>=45&&elapsed<110;
        const lift=Math.max(...feet.map(foot=>foot.lift))/Math.max(.001,layout.yScale);
        crouch=elapsed<45?.36*prepare:travelling?mix(.36,.04+lift*.38,release):.07*settle;
        lean=elapsed<45?-lead*.24*prepare:travelling?lead*mix(-.24,.22,release):lead*.22*settle;
        const gesture=elapsed<45?prepare:elapsed<110?1:1-smooth((elapsed-110)/47);
        const leading=mix(-.20,.32,release),trailing=mix(.52,.62,release);
        left=mix(neutralLeft,lead<0?leading:trailing,gesture);
        right=mix(neutralRight,lead>0?leading:trailing,gesture);
        leftReach=lead<0?.08*release*gesture:0;rightReach=lead>0?.08*release*gesture:0;
        leftOpen=mix(leftOpen,lead<0?mix(.08,.42,release):.45,gesture);
        rightOpen=mix(rightOpen,lead>0?mix(.08,.42,release):.45,gesture);
      } else if(action.kind==='signal') {
        const prepare=smooth(elapsed/22);
        const attack=smooth((elapsed-45)/25),answer=smooth((elapsed-52)/29);
        const recover=1-smooth((elapsed-110)/59);
        if(elapsed<45) {
          crouch=.25*prepare;lean=-lead*.10*prepare;
          left=mix(neutralLeft,-.16,prepare);right=mix(neutralRight,-.12,prepare);
          leftOpen=mix(leftOpen,.08,prepare);rightOpen=mix(rightOpen,.08,prepare);
        } else {
          const main=attack*recover,secondary=answer*recover;
          crouch=.25*(1-attack)+.045*main;lean=lead*mix(-.10,.17,attack)*recover;
          left=mix(neutralLeft,mix(-.16,lead<0?1:.48,lead<0?attack:answer),recover);
          right=mix(neutralRight,mix(-.12,lead>0?1:.48,lead>0?attack:answer),recover);
          leftReach=(lead<0?.34:.045)*(lead<0?main:secondary);
          rightReach=(lead>0?.34:.045)*(lead>0?main:secondary);
          leftOpen=mix(leftOpen,mix(.08,lead<0?1:.42,lead<0?attack:answer),recover);
          rightOpen=mix(rightOpen,mix(.08,lead>0?1:.42,lead>0?attack:answer),recover);
        }
      } else {
        const tuck=smooth(elapsed/45)*(1-smooth((elapsed-110)/59));
        crouch=.78*tuck;left=mix(neutralLeft,-.28,tuck);right=mix(neutralRight,-.24,tuck);
        leftOpen=mix(leftOpen,.04,tuck);rightOpen=mix(rightOpen,.04,tuck);
      }
    }
    return Object.freeze({x,y:layout.y,left,right,leftReach,rightReach,leftOpen,rightOpen,gazeX,gazeY,crouch,lean,
      feet:Object.freeze(feet.map(foot=>Object.freeze({x:foot.x,y:foot.y,planted:foot.planted,lift:foot.lift}))),
      action:action?.kind??null,age:elapsed,stage:stage(),targetX:action?.targetX??(guideActive?guideX:x),
      targetY:action?.targetY??(guideActive?guideY:layout.y),lead:action?.lead??direction(),poster:action?.poster??false});
  }
  reset();
  return Object.freeze({
    guide(nextX:number,nextY:number) {
      if(!Number.isFinite(nextX)||!Number.isFinite(nextY))throw new TypeError('Study guide requires finite coordinates');
      guideActive=true;guideX=clamp(nextX,-1,1);guideY=clamp(nextY,-1,1);
      // Guidance moves attention only. A deliberate cue captures a strut target,
      // so resting hover cannot create an endless chain of locomotion actions.
      if(action===null) {const [gx,gy]=faceTarget();gazeX=gx;gazeY=gy;}
    },
    clearGuide() {guideActive=false;guideX=guideY=0;},
    cue,greet(poster=false) {return cue('signal',poster);},
    step() {
      const previousX=x;
      if(action!==null) {
        x=rootAt(age());action.poster=false;
        if(age()>=ACTION_TICKS)action=null;
      }
      moveFeet(previousX);
      const [gx,gy]=faceTarget();gazeX+=(gx-gazeX)*.14;gazeY+=(gy-gazeY)*.14;
    },
    reset,
    configure(before:CrabStudyOptions) {
      const current=options();
      if(before.seed!==current.seed||before.scene!==current.scene) {reset();return;}
      if(before.scale!==current.scale||before.columns!==current.columns||before.rows!==current.rows) {
        const layout=studyLayout(current);x=clamp(x,-layout.xLimit,layout.xLimit);
        if(action!==null) {
          action.originX=clamp(action.originX,-layout.xLimit,layout.xLimit);
          action.targetX=clamp(action.targetX,-layout.xLimit,layout.xLimit);
          x=rootAt(age());
        }
        // Explicit geometry changes refit and replant, matching the theatre's
        // resize policy. Palette, labels and no-op updates preserve contacts.
        plant();
      }
    },
    snapshot,
  });
}
