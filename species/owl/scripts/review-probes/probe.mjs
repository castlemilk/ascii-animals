import {createOwlDirector,resolveOwlDirectorOptions,validateOwlDirectorCue} from '../../build/director.js';
const out={validation:[]};
for(const [name, fn] of [
 ['scene string wrapper',()=>resolveOwlDirectorOptions({scene:new String('duet')})],
 ['scene array',()=>resolveOwlDirectorOptions({scene:['duet']})],
 ['layout array',()=>resolveOwlDirectorOptions({layout:['split']})],
 ['sparse roles',()=>createOwlDirector({roles:new Array(2)}).getState().actors.map(a=>a.role)],
 ['cue string wrapper',()=>validateOwlDirectorCue({kind:new String('rustle')})],
]){try{out.validation.push({name,accepted:true,result:fn()});}catch(e){out.validation.push({name,accepted:false,error:e.message});}}
const cued=createOwlDirector({scene:'roost',count:2,roles:['sentinel','dreamer']}), control=createOwlDirector({scene:'roost',count:2,roles:['sentinel','dreamer']});
for(let t=1;t<=500;t++){cued.advance(t);control.advance(t);}
out.before={phase:cued.getState().phase.kind,companionBlink:cued.getState().actors[1].pose.blink,companionMotive:cued.getState().actors[1].motive};
for(let t=501;t<=516;t++){cued.advance(t,t===501?[{type:'cue',cue:{kind:'rustle',target:0,x:.8,y:-.6},tick:t,seq:0}]:[]);control.advance(t);if(t===501||t===516){const a=cued.getState().actors[1],b=control.getState().actors[1];(out.delayedCompanion??=[]).push({cueAge:t-501,companionBlink:a.pose.blink,controlBlink:b.pose.blink,companionYaw:a.pose.headYawDeg,controlYaw:b.pose.headYawDeg,companionMotive:a.motive});}}
console.log(JSON.stringify(out,null,2));
