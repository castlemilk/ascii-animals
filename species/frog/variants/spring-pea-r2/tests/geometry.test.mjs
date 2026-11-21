/** R2 numerical anatomy/projection/attachment gates; not browser pixel claims. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeBrowser} from '../../../../../test/helpers/fake-browser.mjs';
import {createFrog,stepFrog} from '../../../generated/frog.mjs';
import {createFrogPond,stepFrogPond,pondPointToWorld} from '../../../generated/pond.mjs';
import {insectHover,tongueMotion,tonguePoint,tongueTarget} from '../../../generated/choreography.mjs';
import {createSpringPeaPreview} from '../preview.mjs';
import {sampleSpringPea,sampleSpringPeaPose,springPeaMouthPoint,springPeaLandmarks} from '../geometry.mjs';
import {poseSpringPea,poseSpringPeaPondFrog} from '../pose.mjs';

const views=['front','left','right','profile'];
const limbs=['rearLeft','rearRight','foreLeft','foreRight'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const distance2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const step=(state,actions=[])=>stepFrog(state,state.tick+1,actions.map((action,index)=>({...action,tick:state.tick+1,seq:state.lastSeq+index+1}))).state;
const bounds=points=>({minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))});

test('the R2 transformed tongue root stays on its sampled mouth stroke in every view and still',()=>{
  for(const size of[.75,1.15])for(const gaze of[-1,1])for(const view of views)for(const staticPose of['rest','crouch','airborne','landed']){
    let state=createFrog({seed:23,config:{size}});state=step(state,[{type:'target',x:gaze,y:0}]);
    const options={view,staticPose,motion:false},pose=poseSpringPea(state,options),mouth=springPeaMouthPoint(pose,view),stroke=[];
    const frame=sampleSpringPea(state,p=>{if(p.part==='mouth')stroke.push(p);},options);
    assert.equal(frame.count,17918);assert(stroke.length>0);
    assert(Math.min(...stroke.map(p=>distance(p,mouth)))<.035*pose.scale,`${size}/${gaze}/${view}/${staticPose}: mouth origin must lie on sampled seam`);
    const target=tongueTarget(mouth,{x:mouth.x+2,y:mouth.y-.4,z:2.08},pose.scale);
    for(const reach of[0,.2,.7,1])assert.deepEqual(tonguePoint(mouth,target,reach,0,pose.scale),mouth,'root remains exactly attached at every extension');
    assert(distance(tonguePoint(mouth,target,1,1,pose.scale),target)<1e-12);
  }
});

test('front expressions retain two separate cream eye domes containing their pupils',()=>{
  for(const x of[-1,0,1])for(const staticPose of['rest','crouch','airborne','landed']){
    let state=createFrog({seed:23});state=step(state,[{type:'target',x,y:0}]);
    const eyes={'eye-left':{cream:[],pupil:[]},'eye-right':{cream:[],pupil:[]}};
    sampleSpringPea(state,p=>{
      if(!eyes[p.part]||p.material!==2)return;
      if(p.light>.8)eyes[p.part].cream.push(p);if(p.light<.12)eyes[p.part].pupil.push(p);
    },{view:'front',staticPose,motion:false});
    const cream=[];
    for(const [name,parts]of Object.entries(eyes)){
      assert(parts.cream.length&&parts.pupil.length);const c=bounds(parts.cream),p=bounds(parts.pupil);cream.push(c);
      assert(p.minX>=c.minX&&p.maxX<=c.maxX&&p.minY>=c.minY&&p.maxY<=c.maxY,`${staticPose}/${x}/${name}: pupil stays inside cream face area`);
    }
    assert(cream[0].maxX<cream[1].minX,`${staticPose}/${x}: separate eyes remain readable in front view`);
  }
});

test('the R2 leap loads over planted feet, stretches, gathers and lands on the committed point',()=>{
  let state=createFrog({seed:23});const initial=springPeaLandmarks(state),keys=new Map();
  const rest=sampleSpringPea(state,()=>{}).bounds;let destination;
  for(let tick=1;tick<=140;tick++){
    state=step(state,tick===1?[{type:'target',x:.7,y:-.5},{type:'leap'}]:[]);
    const b=state.behavior,pose=poseSpringPea(state);
    if(b.kind==='crouch'){
      destination=b.plan.to;const current=springPeaLandmarks(state);
      for(const limb of limbs)assert(distance(current[limb].tip,initial[limb].tip)<1e-12,'anticipation never slides a planted toe');
    }
    if((b.kind==='crouch'&&b.age===12)||(b.kind==='flight'&&[12,36].includes(b.age))||(b.kind==='landing'&&b.age===4))
      keys.set(`${b.kind}/${b.age}`,{pose,bounds:sampleSpringPea(state,()=>{}).bounds});
  }
  const height=b=>b.max.y-b.min.y,width=b=>b.max.x-b.min.x;
  const loaded=keys.get('crouch/12'),launched=keys.get('flight/12'),gathered=keys.get('flight/36'),landed=keys.get('landing/4');
  assert(loaded&&launched&&gathered&&landed,'all normal-speed motion keys were reached');
  assert(height(loaded.bounds)<height(rest)*.85,'anticipation visibly compresses the silhouette');
  assert(width(loaded.bounds)>width(rest)*1.02,'loading broadens the comic silhouette');
  assert(launched.pose.extension>.9&&gathered.pose.extension<.05,'limbs unfold then gather before impact');
  assert(height(launched.bounds)>height(gathered.bounds)*1.1,'launch and gathered fall differ in silhouette');
  assert(height(landed.bounds)<height(rest)*.85,'impact has a readable squash');
  assert.deepEqual(state.position,destination);assert(['idle','interest'].includes(state.behavior.kind));
});

function reachCorner(config,corner){
  let state=createFrog({seed:23,config});
  for(let attempt=0;attempt<3&&distance2(state.position,corner)>1e-10;attempt++){
    state=step(state,[{type:'target',...corner},{type:'leap'}]);
    while(!['idle','interest'].includes(state.behavior.kind))state=step(state);
  }
  assert(distance2(state.position,corner)<1e-10,'reach the corner through valid model inputs');return state;
}
function actualCamera(preview,width,height,size){
  const free=[];
  for(let i=-18;i<=18&&free.length<2;i++){const y=i*.05;if(Math.abs(preview.targetAt({x:0,y}).y)<.8)free.push(y);}
  assert.equal(free.length,2,'find unclamped inverse-projection probes');
  const a=preview.targetAt({x:-.05,y:free[0]}),b=preview.targetAt({x:.05,y:free[1]});
  assert(Math.abs(a.x)<1&&Math.abs(b.x)<1&&Math.abs(a.y)<1&&Math.abs(b.y)<1);
  const sx=width*.05/(1.5*(b.x-a.x)),sy=height*(free[1]-free[0])*.5/(.5*(b.y-a.y));
  assert(Math.abs(sx-sy)<1e-8,'active inverse mapping uses one scale in both axes');
  return {scale:sx,cx:width*.475-sx*1.5*a.x,cy:height*(free[0]+1)*.5-sx*(.2+.62*size+.5*a.y)};
}

test('actual R2 camera stays fixed and contains legal corner leaps with a declared 3px geometry margin',t=>{
  const host=fakeBrowser(),preview=createSpringPeaPreview(host.canvas(320,240),{cols:72,rows:40});preview.resize(320,240,1);
  const required=3,minimum={left:Infinity,right:Infinity,top:Infinity,bottom:Infinity};let cases=0,cameraChecks=0;
  const check=(bounds,camera,width,height,context)=>{
    const margins={left:camera.cx+bounds.min.x*camera.scale,right:width-camera.cx-bounds.max.x*camera.scale,
      top:camera.cy+bounds.min.y*camera.scale,bottom:height-camera.cy-bounds.max.y*camera.scale};
    for(const[edge,margin]of Object.entries(margins)){
      assert(margin>=required,`${context}: ${edge}=${margin.toFixed(4)}px; required >=${required}px`);
      minimum[edge]=Math.min(minimum[edge],margin);
    }
  };
  try{
    for(const config of[{size:1,jumpHeight:.85,maxDistance:1.2},{size:1.11,jumpHeight:1.1,maxDistance:1.5},{size:1.15,jumpHeight:1.1,maxDistance:1.5}]){
      for(const x of[-.9,.9])for(const y of[-.75,.75]){
        let state=reachCorner(config,{x,y});preview.draw(state);const fixed=actualCamera(preview,320,240,config.size);
        for(let tick=0;tick<=112;tick++){
          if(tick)state=step(state,tick===1?[{type:'target',x,y},{type:'leap'}]:[]);
          for(const view of views){
            if(tick%7===0||['crouch','flight','landing','recovery'].includes(state.behavior.kind)&&state.behavior.age===0){
              preview.draw(state,{view});const active=actualCamera(preview,320,240,config.size);
              for(const key of['scale','cx','cy'])assert(Math.abs(active[key]-fixed[key])<1e-9,'camera does not follow or refit the action');
              cameraChecks++;
            }
            const geometry=sampleSpringPea(state,()=>{},{view});
            check(geometry.bounds,fixed,320,240,`${config.size}/${config.jumpHeight} (${x},${y}) ${view} ${state.behavior.kind}/${state.behavior.age??0}`);cases++;
          }
        }
      }
    }
    for(const[width,height]of[[390,520],[1440,1000]]){
      preview.resize(width,height,1);const fit=Math.min(1,1200/width,700/height),w=width*fit,h=height*fit;
      for(const x of[-.9,.9])for(const y of[-.75,.75])for(const view of views){
        const state=reachCorner({size:1.15,jumpHeight:1.1,maxDistance:1.5},{x,y});
        const frame=preview.draw(state,{view});check(frame.geometry.bounds,actualCamera(preview,w,h,1.15),w,h,`${width}x${height}/${view}`);cases++;
      }
    }
  }finally{preview.dispose();}
  assert.equal(cases,5456);
  t.diagnostic(JSON.stringify({evidence:'Numerical geometry and actual renderer inverse projection; not glyph pixel bounds',cases,cameraChecks,requiredMarginPixels:required,minimumMarginPixels:minimum}));
});

test('R2 feeding retains exact root/tip attachment and continuous catch/return across all actor counts and views',t=>{
  let contacts=0,cappedContacts=0,maximumContactTravel=0;
  for(const seed of[23,0xffffffff])for(const size of[.75,1.15])for(const count of[1,2,3])for(let id=0;id<count;id++){
    let state=createFrogPond({seed,config:{size},director:{count,autonomy:false}}),caughtAt=null;
    state=stepFrogPond(state,1,[{type:'hunt',frogId:id,x:.7,y:-.5,tick:1,seq:0}]).state;
    const previous=new Map(),returnLengths=new Map();
    for(let tick=2;tick<=260;tick++){
      state=stepFrogPond(state,tick).state;const actor=state.actors[id],motive=actor.motive;
      if(motive.kind!=='strike'||!state.firefly)continue;
      assert(['idle','interest'].includes(actor.model.behavior.kind),'hunt plants before feeding');
      const contactNow=state.firefly.phase==='caught'&&caughtAt===null;if(contactNow)caughtAt=tick;
      const pose=poseSpringPeaPondFrog(state,actor),envelope=tongueMotion(motive.age,motive.duration),ground=pondPointToWorld(state.firefly.point);
      const hover=insectHover({...ground,y:ground.y+.62*pose.scale},pose.scale,caughtAt??tick,id===2?-1:1,true);
      for(const view of views){
        const mouth=springPeaMouthPoint(pose,view),aim=tongueTarget(mouth,hover,pose.scale);
        assert.deepEqual(tonguePoint(mouth,aim,envelope.reach,0,pose.scale),mouth);
        assert(distance2(mouth,aim)<=1.65*pose.scale+1e-12);
        const prey=caughtAt===null?aim:tonguePoint(mouth,aim,envelope.reach,1,pose.scale);
        if(contactNow){
          assert(previous.has(view));assert.equal(envelope.reach,1);assert(distance(tonguePoint(mouth,aim,1,1,pose.scale),aim)<1e-12);
          const travel=distance2(previous.get(view),prey)/pose.scale;assert(travel<.05,'contact does not teleport the visible prey');
          maximumContactTravel=Math.max(maximumContactTravel,travel);contacts++;if(distance2(mouth,hover)>1.65*pose.scale)cappedContacts++;
        }
        if(caughtAt!==null&&envelope.phase==='return'){
          const length=distance2(mouth,prey),before=returnLengths.get(view);if(before!==undefined)assert(length<before,'caught prey returns continuously');
          returnLengths.set(view,length);
        }
        previous.set(view,prey);
      }
    }
    assert.notEqual(caughtAt,null,'successful hunt reaches contact');assert.equal(state.firefly,null,'prey effect settles and releases its slot');
  }
  assert.equal(contacts,96);assert(cappedContacts>0);
  t.diagnostic(JSON.stringify({contacts,cappedContacts,maximumContactTravel}));
});
