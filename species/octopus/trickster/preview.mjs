import { createOctopusTrickster } from './browser.mjs';

const canvas = document.getElementById('octopus');
const status = document.getElementById('status');
const buttons = Object.fromEntries(['reach','ink','release','pause','restart'].map(id => [id,document.getElementById(id)]));
let artwork, scope;
try {
  artwork = createOctopusTrickster(canvas, {seed:17, reducedMotion:'system', observeVisibility:true});
  scope = new AbortController();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let side = 1;
  function playback() {
    buttons.pause.textContent = artwork.paused ? 'Play' : 'Pause';
    buttons.pause.setAttribute('aria-label',artwork.paused ? 'Play animation':'Pause animation');
    document.getElementById('playback').textContent = artwork.paused ? 'Still':'Playing';
    document.getElementById('motion').hidden = !motion.matches;
  }
  function action(fn,message,kind) {
    if(artwork.paused) {status.textContent='The octopus is still. Choose Play when you want a movement sequence.';return;}
    const stage=artwork.getStats().stage;
    if(kind==='reach' && stage!=='idle') {status.textContent='Let this little moment settle before offering another pearl.';return;}
    if(kind==='ink' && ['gather','hide','peek','settle'].includes(stage)) {status.textContent='The disappearing trick is already underway. Watch for the peek.';return;}
    fn(); status.textContent=message; playback();
  }
  const on=(target,type,fn,opts={})=>target.addEventListener(type,fn,{...opts,signal:scope.signal});
  on(buttons.reach,'click',()=>action(()=>{side*=-1;artwork.invite(side*.72,.32);},'A pearl, just within reach. Watch the eyes, then the leading arm.','reach'));
  on(buttons.ink,'click',()=>action(()=>artwork.pulse(side*.65,.05),'A little disturbance. Gather, disappear, then peek around the ink.','ink'));
  on(buttons.release,'click',()=>{
    if(artwork.paused){status.textContent='The pose remains held. Choose Play before releasing the invitation.';return;}
    const stage=artwork.getStats().stage;
    if(['gather','hide','peek','settle'].includes(stage)){status.textContent='Let the ink clear; this disappearing trick is already underway.';return;}
    artwork.release();status.textContent=stage==='idle'?'Invitation cleared. The octopus stays at rest.':'Invitation released. The arm curls back and settles.';
  });
  on(buttons.pause,'click',()=>{artwork.setPaused(!artwork.paused);playback();status.textContent=artwork.paused?'Paused. This pose will hold.':'Playing. Offer a pearl or try ink peekaboo.';});
  on(buttons.restart,'click',()=>{artwork.restart();playback();status.textContent=artwork.paused?'Restarted as a still.':'Back in the shallows. A fresh little mischief.';});
  on(canvas,'pointerdown',()=>{status.textContent=artwork.paused?'The pose is still. Choose Play to animate.':'Invitation received. Watch where the arm or eye goes next.';});
  on(canvas,'keydown',event=>{if([' ','Enter','j','J','Escape'].includes(event.key))playback();});
  on(motion,'change',()=>{playback();status.textContent=motion.matches?'Reduced motion is on. The pose is held.':'Motion preference updated. Use Play when you are ready.';});
  on(window,'pagehide',event=>{if(!event.persisted){scope.abort();artwork.destroy();}});
  playback();
  if(artwork.paused)status.textContent='A still view of the shallows. Choose Play when you want to meet the trickster.';
}catch(error){scope?.abort();artwork?.destroy();if(status){status.textContent='This study could not start. Canvas 2D and all study controls are required.';status.dataset.error='true';}for(const b of Object.values(buttons).filter(Boolean))b.disabled=true;console.error(error);}
