import { createFoxArtwork as mountFox } from './runtime/public/fox.js';
import { staticFoxPose } from './runtime/species/fox/model.js';
import { buildFoxGrid } from './runtime/species/fox/preview.js';

const byId = id => document.getElementById(id);
const canvas = byId('fox');
const actions = new AbortController();
const sceneIds = ['dusk-hunt', 'moon-play', 'den-watch'];
const beats = ['arrival', 'listening', 'investigation', 'response', 'settling'];
const names = ['Ember', 'Pip', 'Bracken'];
const sceneCopy = {
  'dusk-hunt': {
    title: 'Dusk hunt', cue: 'rustle', cueLabel: 'Rustle the grass',
    invitation: 'A small rustle gives the selected fox something to listen for, investigate, and eventually pounce toward.',
    headings: ['Arriving at dusk', 'Something in the grass', 'A measured approach', 'A small leap of faith', 'The meadow grows quiet'],
    stories: ['Each fox finds its place at the edge of the grass.', 'Ears turn first. The hunters wait; a lookout takes in the scene.', 'A lowered muzzle follows the hint of a trail. Nobody needs to hurry.', 'The crouch holds for a moment, then forepaws reach for the landing.', 'A tail settles. The others have their own ideas about what comes next.'],
  },
  'moon-play': {
    title: 'Moonlit mischief', cue: 'play', cueLabel: 'Invite a little mischief',
    invitation: 'The tail rises first. Ears and head follow, then a bow, careful steps and a short answering hop. Its companions take a moment before joining in.',
    headings: ['Company in the moonlight', 'An invitation to play', 'Follow the mischief', 'One hop, then another', 'A well-earned pause'],
    stories: ['There is room for a small game between the meadow paths.', 'A lifted tail and attentive ears give the game away.', 'A playmate bows and takes measured steps; another keeps watch.', 'Short hops have a beginning, a landing, and space for an answer.', 'Even a playful fox needs a quiet moment before the next invitation.'],
  },
  'den-watch': {
    title: 'Den watch', cue: 'rustle', cueLabel: 'Make a gentle rustle',
    invitation: 'A gentle rustle invites attention without waking the whole meadow at once. Let a dreamer settle while a lookout listens.',
    headings: ['At the edge of home', 'Keeping an ear out', 'A quiet investigation', 'A moment of attention', 'Safe enough to rest'],
    stories: ['The cast settles into the shelter of the evening.', 'One fox listens while the others hold their own unhurried rhythms.', 'A lookout checks the nearby grass. A dreamer has less urgent plans.', 'A small movement is enough to turn a head and raise a tail.', 'Paws fold, tails draw close, and one pair of ears keeps watch.'],
  },
};
const actionNames = { arriving: 'Arriving', listening: 'Listening', stalking: 'Stalking', sniffing: 'Sniffing',
  bowing: 'Play bow', playing: 'Playing', pouncing: 'Pouncing', recovering: 'Recovering', resting: 'At rest', watching: 'Watching' };
const roleNames = { hunter: 'Hunter', playmate: 'Playmate', lookout: 'Lookout', dreamer: 'Dreamer' };
const tableauNames = { listen: 'Listening tableau', pounce: 'Crouch, held still', rest: 'The meadow at rest' };
let controller;
let disposed = false;
let savingPng = false;
let selectedId = 0;
let keyboardGuide = { x: 0, y: .15 };
let lastScene = 'dusk-hunt';
let lastCount = 2;

function setText(id, value) { const element = byId(id); if (element.textContent !== value) element.textContent = value; }
function attribute(element, name, value) { if (element.getAttribute(name) !== value) element.setAttribute(name, value); }
function announce(message) { if (!disposed) setText('action-status', message); }
function describeWind(value) { return Math.abs(value) < .025 ? 'Still air' : `${value < 0 ? 'Left' : 'Right'} · ${Math.round(Math.abs(value) * 100)}%`; }
function displayStatus(status) {
  if (disposed) return;
  const state = status.director;
  setText('pause', status.paused ? 'Resume' : 'Pause');
  attribute(byId('pause'), 'aria-pressed', String(status.paused));
  setText('playback-label', status.reducedMotion ? 'STILL MEADOW' : status.paused ? 'PAUSED MEADOW' : 'LIVE MEADOW');
  setText('motion-note', status.reducedMotion
    ? 'Reduced motion is active. Your invitations select still tableaux; automatic motion stays off.'
    : status.paused ? 'Paused. Scene, settings and replay preserve your pause.' : 'Automatic motion stops when this meadow is out of view.');
  if (!state) return;
  selectedId = state.selectedId;
  lastScene = state.scene;
  lastCount = state.actors.length;
  const copy = sceneCopy[state.scene];
  const beat = Math.max(0, beats.indexOf(state.beat));
  const selected = state.actors.find(actor => actor.id === selectedId) ?? state.actors[0];
  setText('seed-label', String(state.seed));
  setText('cast-summary', `${state.actors.length} ${state.actors.length === 1 ? 'FOX' : 'FOXES'} / DISTINCT INSTINCTS`);
  setText('beat-index', `${String(beat + 1).padStart(2, '0')} / 05`);
  setText('beat-title', status.tableau ? tableauNames[status.tableau] : copy.headings[beat]);
  setText('scene-synopsis', status.tableau ? 'A deliberate still composition. Change the scene or choose another tableau without advancing the simulation.' : copy.stories[beat]);
  setText('phase', status.tableau ? 'STILL TABLEAU' : state.beat.toUpperCase());
  setText('cue-label', copy.cueLabel);
  setText('cue-description', copy.invitation);
  if (selected) { setText('selected-name', selected.name); setText('selected-role', `/ ${selected.role}`); }
  for (const scene of sceneIds) attribute(byId(`scene-${scene}`), 'aria-pressed', String(scene === state.scene));
  for (const step of document.querySelectorAll('[data-beat]')) {
    if (step.dataset.beat === state.beat) attribute(step, 'aria-current', 'step');
    else step.removeAttribute('aria-current');
  }
  for (let id = 0; id < 3; id++) {
    const actor = state.actors.find(item => item.id === id);
    byId(`fox-${id}`).hidden = !actor;
    byId(`role-control-${id}`).hidden = !actor;
    byId(`role-${id}`).disabled = !actor;
    if (!actor) continue;
    attribute(byId(`fox-${id}`), 'aria-pressed', String(id === selectedId));
    setText(`role-label-${id}`, roleNames[actor.role]);
    setText(`action-label-${id}`, actionNames[actor.action]);
    attribute(byId(`fox-${id}`), 'aria-label', `Direct ${actor.name}, ${roleNames[actor.role].toLowerCase()}`);
  }
  attribute(canvas, 'aria-label', `${copy.title}: ${state.actors.length} stylized ASCII ${state.actors.length === 1 ? 'fox' : 'foxes'} in a meadow. ${selected?.name ?? 'Ember'} is selected.`);
}
function syncOptions() {
  const options = controller.getDirectorOptions();
  byId('count').value = String(options.count);
  for (const key of ['pace', 'curiosity', 'wind', 'spacing']) byId(key).value = String(options[key]);
  byId('labels').checked = options.showLabels;
  setText('pace-value', `${options.pace.toFixed(2)}×`);
  setText('curiosity-value', `${Math.round(options.curiosity * 100)}%`);
  setText('wind-value', describeWind(options.wind));
  setText('spacing-value', `${options.spacing.toFixed(2)}×`);
  for (let id = 0; id < 3; id++) byId(`role-${id}`).value = options.roles[id] ?? 'auto';
  displayStatus(controller.getStatus());
}
function listen(element, event, callback) {
  element.addEventListener(event, value => {
    if (disposed) return;
    try { callback(value); } catch (error) { announce(`Could not apply the change: ${error.message}`); }
  }, { signal: actions.signal });
}
function on(id, event, callback) { listen(byId(id), event, callback); }
function cue(kind, point) {
  if (point) controller.cue(kind, selectedId, point);
  else controller.cue(kind, selectedId);
  const status = controller.getStatus();
  const actor = status.director?.actors.find(item => item.id === selectedId);
  const name = actor?.name ?? names[selectedId];
  const phrases = { rustle: 'a local rustle', pounce: 'a pounce', play: 'a playful invitation', rest: 'a quiet rest' };
  announce(status.paused || status.reducedMotion ? `${name}: ${tableauNames[status.tableau] ?? 'The meadow is held still'}. Playback stays still.`
    : `${name} received ${phrases[kind]}. An active response finishes before another can begin.`);
  displayStatus(status);
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link);
  try { link.click(); } finally { link.remove(); URL.revokeObjectURL(url); }
}

try {
  controller = mountFox(canvas, { fox: { seed: 17 }, director: { scene: 'dusk-hunt', count: 2 }, onStatus: displayStatus });
  syncOptions();
  for (const scene of sceneIds) on(`scene-${scene}`, 'click', () => {
    controller.configureDirector({ scene });
    keyboardGuide = { x: 0, y: .15 };
    syncOptions();
    announce(`${sceneCopy[scene].title} begins. Your cast, settings and pause choice are preserved.`);
  });
  for (let id = 0; id < 3; id++) {
    on(`fox-${id}`, 'click', () => { controller.selectFox(id); displayStatus(controller.getStatus()); announce(`Directing ${names[id]}. The next invitation is for this fox.`); });
    on(`role-${id}`, 'change', () => {
      const roles = [...controller.getDirectorOptions().roles];
      while (roles.length < 3) roles.push('auto');
      roles[id] = byId(`role-${id}`).value;
      controller.configureDirector({ roles }); syncOptions();
      announce(`${names[id]}'s instinct is now ${roles[id] === 'auto' ? 'guided by the scene' : roles[id]}.`);
    });
  }
  on('scene-cue', 'click', () => cue(sceneCopy[lastScene].cue));
  on('tail-curiosity', 'click', () => cue('play'));
  on('pounce', 'click', () => cue('pounce'));
  on('rest', 'click', () => cue('rest'));
  on('pause', 'click', () => {
    controller.setPaused(!controller.getStatus().paused); const status = controller.getStatus(); displayStatus(status);
    announce(status.reducedMotion ? 'Reduced motion remains active.' : status.paused ? 'The meadow is paused.' : 'The meadow is moving again.');
  });
  on('reset', 'click', () => { controller.reset(17); keyboardGuide = { x: 0, y: .15 }; syncOptions(); announce('This scene restarts from seed 17. Settings and your pause choice are preserved.'); });
  on('count', 'change', () => { controller.configureDirector({ count: Number(byId('count').value) }); syncOptions(); announce(`${lastCount} ${lastCount === 1 ? 'fox is' : 'foxes are'} in the meadow. Surviving foxes keep their identities.`); });
  for (const key of ['pace', 'curiosity', 'wind', 'spacing']) on(key, 'input', () => { controller.configureDirector({ [key]: Number(byId(key).value) }); syncOptions(); });
  on('labels', 'change', () => { controller.configureDirector({ showLabels: byId('labels').checked }); syncOptions(); });
  for (const pose of ['listen', 'pounce', 'rest']) on(`still-${pose}`, 'click', () => { controller.showTableau(pose); displayStatus(controller.getStatus()); announce(`${tableauNames[pose]}. Playback is paused.`); });
  listen(canvas, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const directions = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] };
    const delta = directions[event.key];
    if (delta) {
      event.preventDefault();
      keyboardGuide = { x: Math.max(-1, Math.min(1, keyboardGuide.x + delta[0])), y: Math.max(-1, Math.min(1, keyboardGuide.y + delta[1])) };
      controller.guide(keyboardGuide.x, keyboardGuide.y);
    } else if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) cue('rustle', keyboardGuide); }
    else if (event.key.toLowerCase() === 'c') { event.preventDefault(); if (!event.repeat) cue('play', keyboardGuide); }
    else if (event.key.toLowerCase() === 'p') { event.preventDefault(); if (!event.repeat) cue('pounce', keyboardGuide); }
    else if (event.key === ' ') { event.preventDefault(); if (!event.repeat) byId('pause').click(); }
    else if (event.key === 'Escape') { controller.leave(); announce('The guide is cleared. Each fox returns to its own instinct.'); }
  });
  on('capture', 'click', () => {
    byId('text-frame').textContent = controller.exportText(); byId('text-export').open = true;
    announce('The actual current ASCII meadow is captured below.');
  });
  on('save-png', 'click', () => {
    if (savingPng) return;
    if (typeof canvas.toBlob !== 'function') throw new Error('PNG export is unavailable in this browser. Capture ASCII instead.');
    savingPng = true; byId('save-png').disabled = true;
    const capturedScene = lastScene;
    const capturedSeed = controller.getDirectorState()?.seed ?? 17;
    try {
      canvas.toBlob(blob => {
        savingPng = false;
        if (disposed) return;
        byId('save-png').disabled = false;
        if (!blob) { announce('The browser could not create a PNG. Capture ASCII instead.'); return; }
        try { downloadBlob(blob, `fox-${capturedScene}-seed-${capturedSeed}.png`); announce('The currently rendered meadow was saved as a PNG.'); }
        catch (error) { announce(`PNG export failed: ${error.message}`); }
      }, 'image/png');
    } catch (error) { savingPng = false; byId('save-png').disabled = false; throw error; }
  });
} catch (error) {
  controller?.dispose();
  actions.abort();
  const specimen = buildFoxGrid(staticFoxPose({ seed: 17 }), { cols: 80, rows: 32 });
  byId('text-frame').textContent = specimen.text; byId('text-export').open = true; canvas.hidden = true;
  for (const element of document.querySelectorAll('button,input,select')) element.disabled = true;
  setText('playback-label', 'TEXT SPECIMEN'); setText('beat-title', 'A quiet character study'); setText('phase', 'STATIC');
  announce(`The interactive Canvas meadow is unavailable. A static fox specimen is shown below. ${error.message}`);
}

// A bfcache entry retains its mount. A genuine departure releases page listeners
// and the controller; late PNG callbacks cannot create a download after departure.
window.addEventListener('pagehide', event => {
  if (!event.persisted) { disposed = true; controller?.dispose(); actions.abort(); }
}, { signal: actions.signal });
