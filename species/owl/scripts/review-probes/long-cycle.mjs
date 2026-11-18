import {createOwlDirector} from '../../build/director.js';
const d=createOwlDirector({count:1,autonomous:false}, {blinkTicks:60,ruffleTicks:120,stretchTicks:180,recoveryTicks:180,cooldownTicks:600});
let second,maxSecondWing=0;
for(let tick=1;tick<=960;tick++){
 const events=tick===1||tick===600?[{tick,seq:tick===1?0:1,type:'cue',cue:{kind:'stretch',target:0}}]:[];
 const result=d.advance(tick,events);
 if(tick===600)second={acceptedCues:result.acceptedCues,ignoredCues:result.ignoredCues,cue:result.state.cue,coreBehavior:result.state.actors[0].simulation.behavior,coreCycleStarted:result.state.actors[0].simulation.cycle?.startTick};
 if(tick>=600)maxSecondWing=Math.max(maxSecondWing,d.getState().actors[0].pose.leftWing);
}
console.log(JSON.stringify({second,maxSecondWing,duringSecondCoreCycleStart:d.getState().actors[0].simulation.cycle?.startTick},null,2));
