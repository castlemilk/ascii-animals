import { createCuttlefishStudy } from '../../lib/animals/cuttlefish-study.js';

const byId = id => document.getElementById(id);
const canvas = byId('artwork');
const scope = new AbortController();
const on = (target, type, callback) => target.addEventListener(type, callback, { signal: scope.signal });
const manual = new URLSearchParams(location.search).has('manual');
export const study = (() => {
  try {
    return createCuttlefishStudy(canvas, {}, { seed: 20261119, autoStart: !manual });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    byId('status').textContent = `This study could not open. ${reason}`;
    byId('phase').textContent = 'Unavailable';
    canvas.setAttribute('aria-label', 'The cuttlefish artwork could not open. See the status message.');
    document.querySelectorAll('button, input').forEach(control => { control.disabled = true; });
    scope.abort();
    throw error;
  }
})();
let keyboardTarget = { x: .22, y: -.06 };
let disposed = false;
let timer;
const names = { investigate: 'Investigating your invitation.', turn: 'Turning through the current.', retreat: 'A warning, an ink cloud, then a quiet return.' };
const stillAt = { investigate: 3.2, turn: 2.0, retreat: 2.3 };

export function sync() {
  if (disposed) return;
  const stats = study.getStats(), state = study.getStudy();
  byId('pause').textContent = stats.paused ? 'Play' : 'Pause';
  byId('pause').setAttribute('aria-label', stats.paused ? 'Play animation' : 'Pause animation');
  const phase = state.action?.kind === 'retreat' && stats.reactionStage !== 'idle' ? stats.reactionStage : state.phase;
  byId('phase').textContent = `${stats.paused ? 'Still / ' : ''}${phase[0].toUpperCase()}${phase.slice(1)}`;
  document.querySelectorAll('[data-action]').forEach(button => button.setAttribute('aria-pressed', String(state.action?.kind === button.dataset.action)));
}
function action(type) {
  if (study.paused) {
    study.showStudyStill(type, stillAt[type], keyboardTarget);
    byId('status').textContent = 'A still from this sequence. Press Play when you are ready.';
  } else {
    const accepted = study.cueStudy({ type, ...keyboardTarget });
    byId('status').textContent = accepted ? names[type] : 'Let this movement finish, then invite another.';
  }
  sync();
}
document.querySelectorAll('[data-action]').forEach(button => on(button, 'click', () => action(button.dataset.action)));
document.querySelectorAll('[data-mode]').forEach(button => on(button, 'click', () => {
  study.setOptions({ mode: button.dataset.mode });
  document.querySelectorAll('[data-mode]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
}));
on(byId('pause'), 'click', () => {
  study.setPaused(!study.paused);
  byId('status').textContent = study.paused ? 'Paused. You can still explore each movement as a still.' : 'Watching the current.';
  sync();
});
on(byId('restart'), 'click', () => { study.restart(); byId('status').textContent = study.paused ? 'A fresh, quiet still.' : 'Back in the current.'; sync(); });
on(byId('automatic'), 'change', event => study.setStudy({ automatic: event.target.checked }));
on(canvas, 'keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (['i', 't', 'r'].includes(key)) { event.preventDefault(); action({ i: 'investigate', t: 'turn', r: 'retreat' }[key]); }
  else if (key === ' ') { event.preventDefault(); byId('pause').click(); }
  else if (key === 'escape') { study.restart(); sync(); }
  else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    event.preventDefault();
    keyboardTarget.x = Math.max(-.4, Math.min(.4, keyboardTarget.x + (key === 'arrowright' ? .06 : key === 'arrowleft' ? -.06 : 0)));
    keyboardTarget.y = Math.max(-.35, Math.min(.35, keyboardTarget.y + (key === 'arrowdown' ? .06 : key === 'arrowup' ? -.06 : 0)));
    if (!study.paused) study.cueStudy({ type: 'pointer', ...keyboardTarget });
    byId('status').textContent = 'Point of interest moved. Press I to invite a closer look.';
  }
});
on(byId('save'), 'click', () => canvas.toBlob(blob => {
  if (!blob || disposed) return;
  const href = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = href; link.download = 'cuttlefish-field-study.png'; link.click();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}, 'image/png'));
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
on(motion, 'change', event => {
  if (event.matches) byId('status').textContent = 'Motion preference respected. Explore a still, or choose Play.';
  sync();
});
function startStatus() { clearInterval(timer); if (!document.hidden && !disposed) timer = setInterval(sync, 250); }
on(document, 'visibilitychange', startStatus);
export function dispose() { if (disposed) return; disposed = true; clearInterval(timer); scope.abort(); study.destroy(); }
on(window, 'pagehide', event => { if (!event.persisted) dispose(); });
if (study.paused) byId('status').textContent = 'A quiet still, following your motion preference. Choose a movement to explore it.';
sync(); startStatus();
