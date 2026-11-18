import { createTurtleArtwork } from './runtime/public/turtle.js';
const $=id=>document.getElementById(id),art=createTurtleArtwork($('animal'));
function sync(){const s=art.getStatus();$('pause').textContent=s.paused?'Play':'Pause';$('status').textContent=`${s.paused?'STILL':'LIVE'} / ${s.phase.toUpperCase()}`;$('motion-note').textContent=s.reducedMotion?'Reduced motion: a still study. Approach changes the pose; playback remains still.':'Pointer guidance never starts playback. Pause and reset preserve your choice.';}
$('pause').onclick=()=>{art.getStatus().paused?art.play():art.pause();sync();};$('greet').onclick=()=>{art.pulse();sync();};$('reset').onclick=()=>{art.restart();sync();};
for(const key of ['behavior','palette','facing'])$(key).onchange=()=>{art.update({[key]:$(key).value});sync();};
for(const key of ['speed','scale'])$(key).oninput=()=>{const value=Number($(key).value);art.update({[key]:value});$(key+'-value').textContent=value.toFixed(2)+'×';};
for(const [id,x] of [['left',-1],['center',0],['right',1]])$(id).onclick=()=>{art.update({behavior:'curious'});$('behavior').value='curious';art.guide(x,0);sync();};
$('capture').onclick=()=>{$('capture-region').hidden=false;$('text-frame').textContent=art.getFrame().text;};
const timer=setInterval(sync,250);window.addEventListener('pagehide',event=>{if(!event.persisted){clearInterval(timer);art.dispose();}});sync();
