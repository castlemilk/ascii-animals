'use strict';
// Dependency-free numerical regression checks; browser rendering is verified separately.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const noop=()=>{};
function context(){return new Proxy({createRadialGradient:()=>({addColorStop:noop}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});}
function canvas(w=947,h=707){const ctx=context();return {getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:w,height:h}),addEventListener:noop,removeEventListener:noop,dispatchEvent:noop};}
let clock=1000;
const scope={console,performance:{now:()=>clock},document:{createElement:()=>canvas(),addEventListener:noop,removeEventListener:noop,hidden:false},window:{devicePixelRatio:1},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame:noop,CustomEvent:class{}};
vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','test','fixtures','legacy-artwork.cjs'),'utf8'),scope);const Artwork=scope.window.CuttlefishArtwork;
let samples=0,maxSamples=0,minNear=Infinity,clipped=0,bad=0,cases=0;
const originalPut=Artwork.prototype._put;
Artwork.prototype._put=function(x,y,z,light,kind,seed){const p=this._world(x,y,z),denom=1-p[2]*this.perspectiveStrength;if(![...p,denom,light].every(Number.isFinite))bad++;minNear=Math.min(minNear,denom);if(denom<.16)clipped++;samples++;originalPut.call(this,x,y,z,light,kind,seed);maxSamples=Math.max(maxSamples,this.sampleCount);};
const options=(patch={})=>({count:4,formation:'independent',size:.7,sizeVariation:.45,scene:'reactive',speed:1,...patch});
const a=new Artwork(canvas(),options());
function tick(a,dt){clock+=dt*1000;a._tick(clock);}
for(const count of [1,4,12])for(const formation of ['independent','horizontal','vertical','diagonal','random'])for(const size of [.7,1.4]){
 a.setOptions(options({count,formation,size,sizeVariation:size===1.4?1:.45,depthStrength:2,scene:'reactive'}));
 for(const t of [0,10.3]){
  a.time=t;for(const f of a.fish)f.sceneTime=t;a.render();cases++;
  const stats=a.getStats();assert.equal(stats.count,count);assert.equal(stats.fish.length,count);assert(stats.visibleCount>=0&&stats.visibleCount<=count);
  for(const f of a.fish)for(const v of [f.worldX,f.worldY,f.worldZ,f.size,f.r00,f.r11,f.r22])assert(Number.isFinite(v));
 }
}
assert.equal(bad,0);assert.equal(clipped,0);assert(maxSamples<36000);console.log("Geometry passed",JSON.stringify({cases,samples,maxSamples,minNear}));
// A visible cell's owner, rather than a shared bounding box, receives the click.
a.setOptions(options({count:4,formation:'horizontal',size:.7,depthStrength:1.2}));a.restart();a._tick(clock);
const id=a.fish.find(f=>f.visible&&f.id>0)?.id??0;
const idx=a.owners.findIndex(x=>x===id);assert(idx>=0);
const x=(idx%a.cols+.5)*a.cellW,y=(Math.floor(idx/a.cols)+.5)*a.cellH;
a._touch({clientX:x,clientY:y,pointerType:'mouse'});
assert.equal(a.fish.filter(f=>f.reaction.active).length,1);assert(a.fish[id].reaction.active);assert.equal(a.ink.length,0);
const clicked=a.fish[id],neighbor=a.fish.find(f=>f.id!==id),neighborStart=neighbor.sceneTime,start=[clicked.worldX,clicked.worldY,clicked.worldZ];
let sequence=[],firstInk=null,firstEscape=null,maxSprayTravel=0;
const realRender=Artwork.prototype.render;
Artwork.prototype.render=function(){for(const f of this.fish){this._activateFish(f);this._camera(this.time+f.offset);this._saveFish();}this._activateFish(this.fish[0]);};
for(let i=0;i<550;i++){
 tick(a,1/60);const stage=a._stageOf(clicked.reaction);if(sequence.at(-1)!==stage)sequence.push(stage);
 if(a.ink.length&&firstInk===null)firstInk=clicked.reaction.age;
 if(stage==='escape'&&firstEscape===null)firstEscape=clicked.reaction.age;
 if(stage==='react'||stage==='spray')maxSprayTravel=Math.max(maxSprayTravel,Math.hypot(clicked.worldX-start[0],clicked.worldY-start[1],clicked.worldZ-start[2]));
}
assert.deepEqual(sequence,['react','spray','escape','recover','idle']);assert(firstInk>=.34&&firstInk<.38);assert(firstEscape>=.94&&firstEscape<.98);assert(maxSprayTravel<=.046);assert(neighbor.sceneTime-neighborStart>9);assert.equal(neighbor.reaction.active,false);
const originalCounts=a.fish.length;a.setPaused(true);const times=a.fish.map(f=>f.sceneTime);tick(a,.1);assert.deepEqual(a.fish.map(f=>f.sceneTime),times);a.restart();assert.equal(a.paused,true);assert.equal(a.fish.length,originalCounts);assert.equal(a.ink.length,0);assert(a.fish.every(f=>!f.reaction.active&&f.sceneTime===0&&f.agitation===0));
// All four directional routes move in the expected direction; reversing works.
const paths=[];
for(const formation of ['horizontal','vertical','diagonal','random'])for(const reverse of [false,true]){
 a.setOptions(options({count:1,formation,reverse,sizeVariation:0}));a.restart();const f=a.fish[0];f.sceneTime=2;a.render();const before=[f.worldX,f.worldY,f.worldZ];f.sceneTime=2.03;a.render();const delta=[f.worldX-before[0],f.worldY-before[1],f.worldZ-before[2]];
 if(formation==='horizontal')assert(delta[0]*(reverse?-1:1)>0);
 if(formation==='vertical')assert(delta[1]*(reverse?1:-1)>0);
 if(formation==='diagonal'){assert(delta[0]*(reverse?-1:1)>0);assert(delta[1]*(reverse?1:-1)>0);}
 const along=delta[0]*f.r00+delta[1]*f.r10+delta[2]*f.r20;assert(along>0);
 paths.push({formation,reverse,delta});
}
// The original single encounter reaches a hold while local arm time advances.
a.setOptions(options({count:1,formation:'independent',scene:'encounter',size:1,sizeVariation:0}));a.restart();a.setPaused(false);a._tick(clock);for(let i=0;i<730;i++)tick(a,1/60);assert.equal(a.fish[0].sceneTime,11.5);assert(a.time>12);assert(a.fish[0].encounterGrip>.99);
const report={geometry:{cases,samples,maxSamples,minNear,clipped,bad},targetedClick:{id:id+1,sequence,firstInk,firstEscape,maxSprayTravel,neighborAdvanced:neighbor.sceneTime-neighborStart},pauseRestart:'passed',directions:paths,encounterHold:'passed'};
console.log(JSON.stringify(report,null,2));
