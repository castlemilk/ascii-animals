import { createButterflyArtwork } from './runtime/public/butterfly.js';

const $ = id => document.getElementById(id);
const canvas = $('animal');
const narrow = window.matchMedia('(max-width: 620px)');
const sceneButtons = [...document.querySelectorAll('[data-scene]')];
const roleNames = { auto: 'Follow the scene', forager: 'Forager · seeks flowers', scout: 'Scout · explores the air', basker: 'Basker · seeks stillness', wanderer: 'Wanderer · takes the long way' };
const sceneNames = { morning: 'First light', nectar: 'Nectar rounds', breeze: 'Passing breeze', roost: 'Evening roost', specimen: 'Single specimen' };
const presets = {
  morning: { count: 4, path: 'meadow', breeze: .2, roles: ['forager', 'scout', 'basker', 'wanderer'] },
  nectar: { count: 5, path: 'meadow', breeze: .05, roles: ['forager', 'forager', 'scout', 'forager', 'basker'] },
  breeze: { count: 4, path: 'ribbon', breeze: .65, roles: ['wanderer', 'scout', 'forager', 'basker'] },
  roost: { count: 4, path: 'spiral', breeze: .08, roles: ['forager', 'wanderer', 'scout', 'basker'] }
};
const activityNames = { flutter: 'Fluttering through the meadow', glide: 'Gliding on the air', inspect: 'Inspecting a flower', nectar: 'Sipping nectar', perch: 'Resting on a stem', bask: 'Warming patterned wings', shelter: 'Sheltering from the breeze', recover: 'Returning to the garden' };
const grid = () => narrow.matches ? { columns: 104, rows: 86 } : { columns: 144, rows: 68 };
const disposers = [];
let art;
let statusTimer = null;
let disposed = false;
let timelineScene = '';
let roleCount = -1;
let guideX = 0;
let guideY = 0;

function listen(target, type, listener, options) {
  target.addEventListener(type, listener, options);
  disposers.push(() => target.removeEventListener(type, listener, options));
}

function announce(message) { $('announcement').textContent = message; }

function reportError(error) {
  $('error').hidden = false;
  $('error-detail').textContent = `The artwork could not start: ${error instanceof Error ? error.message : 'unknown error'}.`;
  canvas.hidden = true;
  for (const control of document.querySelectorAll('button, input, select')) control.disabled = true;
  $('status').textContent = 'GARDEN UNAVAILABLE';
}

function makeRoles(config) {
  $('roles').replaceChildren();
  for (let index = 0; index < config.count; index++) {
    const card = document.createElement('div');
    card.className = 'role-card';
    const number = document.createElement('span');
    number.className = 'visitor-number';
    number.textContent = String(index + 1).padStart(2, '0');
    number.setAttribute('aria-hidden', 'true');
    const field = document.createElement('div');
    const label = document.createElement('label');
    label.htmlFor = `role-${index}`;
    label.textContent = `Visitor ${index + 1}`;
    const select = document.createElement('select');
    select.id = `role-${index}`;
    select.dataset.index = String(index);
    for (const [value, text] of Object.entries(roleNames)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    select.value = config.roles[index] ?? 'auto';
    const activity = document.createElement('span');
    activity.id = `activity-${index}`;
    activity.className = 'visitor-activity';
    activity.setAttribute('aria-live', 'off');
    activity.textContent = 'Finding its own rhythm';
    field.append(label, select);
    card.append(number, field, activity);
    $('roles').append(card);
  }
  roleCount = config.count;
}

function makeTimeline(scene) {
  const descriptor = art.getScenes().find(item => item.id === scene);
  $('act-timeline').replaceChildren();
  for (const [index, act] of (descriptor?.acts ?? []).entries()) {
    const item = document.createElement('li');
    item.dataset.number = String(index + 1).padStart(2, '0');
    item.textContent = act.label;
    $('act-timeline').append(item);
  }
  timelineScene = scene;
}

function syncSettings() {
  const options = art.getOptions();
  const director = options.director;
  for (const button of sceneButtons) button.setAttribute('aria-pressed', String(button.dataset.scene === director.scene));
  $('count').value = String(director.count);
  $('count-value').value = String(director.count);
  $('path').value = director.path;
  $('pointer-mode').value = director.pointerMode;
  $('breeze').value = String(director.breeze);
  const wind = Math.abs(director.breeze);
  $('breeze-value').value = wind < .05 ? 'Still air' : `${wind > .6 ? 'Strong' : 'Gentle'} ${director.breeze < 0 ? 'left' : 'right'}`;
  $('show-labels').checked = director.showLabels;
  $('palette').value = options.palette;
  for (const key of ['speed', 'scale']) { $(key).value = String(options[key]); $(`${key}-value`).value = `${options[key].toFixed(2)}×`; }
  $('scene-seconds').value = String(director.sceneSeconds);
  $('scene-seconds-value').value = `${director.sceneSeconds}s`;
  $('spread').value = String(director.spread);
  $('spread-value').value = `${director.spread.toFixed(2)}×`;
  if (roleCount !== director.count) makeRoles(director);
  for (let i = 0; i < director.count; i++) $(`role-${i}`).value = director.roles[i] ?? 'auto';
  if (timelineScene !== director.scene) makeTimeline(director.scene);
  const hint = director.pointerMode === 'attract'
    ? 'Move gently to invite a closer look. Tap a flower to land, sip and fan; tap open air to gather. B sends a breeze, then a recovery glide.'
    : director.pointerMode === 'breeze'
      ? 'Move across the garden to bend the air. Tap to start a brief brace, powered escape, glide and return to shelter.'
      : 'You are a quiet observer. The visitors follow their own paths; use the director cues whenever you want to join in.';
  $('canvas-help').textContent = hint;
  canvas.setAttribute('aria-label', `${director.count} ASCII ${director.count === 1 ? 'butterfly' : 'butterflies'} in ${sceneNames[director.scene] ?? 'the garden'}, with four patterned wings and individual habits. Use the adjacent controls or focus the artwork for keyboard direction.`);
}

function syncStatus() {
  if (disposed || !art) return;
  const status = art.getStatus();
  const garden = art.getGarden();
  const options = art.getOptions();
  $('pause').disabled = status.reducedMotion;
  $('pause').textContent = status.reducedMotion ? 'Still garden' : options.paused ? 'Play' : 'Pause';
  $('pause').setAttribute('aria-label', status.reducedMotion ? 'System reduced motion is active' : options.paused ? 'Play garden animation' : 'Pause garden animation');
  $('status').textContent = status.reducedMotion ? 'STILL STUDY' : status.paused ? 'PAUSED GARDEN' : 'LIVING GARDEN';
  document.querySelector('.stage').classList.toggle('is-still', status.paused);
  $('garden-count').textContent = `${garden.members.length} ${garden.members.length === 1 ? 'VISITOR' : 'VISITORS'}`;
  $('current-act').textContent = garden.actLabel;
  const cueLabels = { none: 'Following the meadow', gather: 'An invitation to nectar', breeze: 'A passing breath of air', rest: 'A moment of stillness' };
  $('cue-state').textContent = cueLabels[garden.cue] ?? 'Following the meadow';
  [...$('act-timeline').children].forEach((item, index) => {
    item.dataset.current = String(index === garden.actIndex);
    item.dataset.complete = String(index < garden.actIndex);
    if (index === garden.actIndex) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  for (const [id, cue] of [['gather', 'gather'], ['send-breeze', 'breeze'], ['rest', 'rest']]) $(id).dataset.active = String(garden.cue === cue);
  for (const [index, member] of garden.members.entries()) {
    const target = $(`activity-${index}`);
    if (!target) continue;
    const flower = member.activity.flower;
    target.textContent = `${member.activity.kind === 'inspect' && member.activity.target === 'invitation' ? 'Inspecting your invitation' : activityNames[member.activity.kind] ?? member.activity.kind}${Number.isInteger(flower) && ['inspect', 'nectar', 'perch'].includes(member.activity.kind) ? ` · ${flower + 1}` : ''}`;
  }
  $('motion-note').textContent = status.reducedMotion
    ? 'Your reduced-motion preference keeps the garden still. Next act, nectar, breeze and rest select deliberate still poses; they never start playback.'
    : options.paused
      ? 'The garden is paused. Next act and the three cues choose deliberate still poses. Restart keeps it paused.'
      : 'Pause holds the garden. You can still choose an act, offer nectar, or invite a resting pose.';
}

function change(options, message) {
  art.update(options);
  syncSettings();
  syncStatus();
  if (message) announce(message);
}

function cue(name) {
  art.cue(name);
  syncStatus();
  announce(({ gather: 'A nectar invitation. Watch the approach, landing and slow wing fan.', breeze: 'A passing breeze. Watch the wings brace, escape, glide and recover.', rest: 'A quiet invitation. The visitors choose a resting pose.' })[name]);
}

function togglePause() {
  if (art.getStatus().reducedMotion) { announce('System reduced motion keeps the garden still. Choose Next act to explore the scene.'); return; }
  art.getOptions().paused ? art.play() : art.pause();
  syncStatus();
  announce(art.getOptions().paused ? 'The garden is paused.' : 'The garden is playing.');
}

function nextAct() {
  art.nextAct();
  syncStatus();
  announce(`${sceneNames[art.getGarden().scene]}: ${art.getGarden().actLabel}.`);
}

function release() {
  guideX = guideY = 0;
  art.release();
  syncStatus();
  announce('Invitation released. The visitors return to their own paths.');
}

function startStatus() { if (statusTimer === null && !document.hidden && !disposed) statusTimer = window.setInterval(syncStatus, 250); }
function stopStatus() { if (statusTimer !== null) { window.clearInterval(statusTimer); statusTimer = null; } }
function dispose() {
  if (disposed) return;
  disposed = true;
  stopStatus();
  for (const remove of disposers.splice(0)) remove();
  art?.dispose();
}

try {
  art = createButterflyArtwork(canvas, {
    ...grid(),
    director: { scene: 'morning', ...presets.morning, sceneSeconds: 32, spread: 1, pointerMode: 'attract', showLabels: false }
  });
  for (const button of sceneButtons) listen(button, 'click', () => {
    const scene = button.dataset.scene;
    art.update({ director: { scene, ...presets[scene] } });
    art.restart();
    guideX = guideY = 0;
    syncSettings();
    syncStatus();
    announce(`${sceneNames[scene]}. The garden is composed for a new scene.`);
  });
  listen($('pause'), 'click', togglePause);
  listen($('next-act'), 'click', nextAct);
  listen($('reset'), 'click', () => { art.restart(); guideX = guideY = 0; syncStatus(); announce('Scene restarted. Your director settings and playback choice are preserved.'); });
  listen($('gather'), 'click', () => cue('gather'));
  listen($('send-breeze'), 'click', () => cue('breeze'));
  listen($('rest'), 'click', () => cue('rest'));
  listen($('release'), 'click', release);
  listen($('count'), 'input', () => change({ director: { count: Number($('count').value) } }));
  listen($('path'), 'change', () => change({ director: { path: $('path').value } }, 'Flight paths updated.'));
  listen($('pointer-mode'), 'change', () => { art.release(); change({ director: { pointerMode: $('pointer-mode').value } }, 'Your presence in the garden has changed.'); });
  listen($('breeze'), 'input', () => change({ director: { breeze: Number($('breeze').value) } }));
  listen($('show-labels'), 'change', () => change({ director: { showLabels: $('show-labels').checked } }));
  listen($('palette'), 'change', () => change({ palette: $('palette').value }));
  for (const key of ['speed', 'scale']) listen($(key), 'input', () => change({ [key]: Number($(key).value) }));
  listen($('scene-seconds'), 'input', () => change({ director: { sceneSeconds: Number($('scene-seconds').value) } }));
  listen($('spread'), 'input', () => change({ director: { spread: Number($('spread').value) } }));
  listen($('roles'), 'change', event => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const index = Number(select.dataset.index);
    const config = art.getOptions().director;
    if (!Number.isInteger(index) || index < 0 || index >= config.count) return;
    const roles = Array.from({ length: Math.max(config.roles.length, config.count) }, (_, i) => config.roles[i] ?? 'auto');
    roles[index] = select.value;
    change({ director: { roles } }, `Visitor ${index + 1}: ${roleNames[select.value]}.`);
  });
  listen(canvas, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      if (event.key === 'ArrowLeft') guideX -= .15;
      if (event.key === 'ArrowRight') guideX += .15;
      if (event.key === 'ArrowUp') guideY -= .15;
      if (event.key === 'ArrowDown') guideY += .15;
      guideX = Math.max(-1, Math.min(1, guideX));
      guideY = Math.max(-1, Math.min(1, guideY));
      art.guide(guideX, guideY);
      syncStatus();
      return;
    }
    if (event.repeat) return;
    const action = { Enter: () => cue('gather'), b: () => cue('breeze'), B: () => cue('breeze'), n: nextAct, N: nextAct, ' ': togglePause, Escape: release }[event.key];
    if (action) { event.preventDefault(); action(); }
  });
  listen($('capture'), 'click', () => {
    $('text-frame').textContent = art.getFrame().text;
    $('capture-region').hidden = false;
    $('text-frame').focus({ preventScroll: true });
    $('capture-region').scrollIntoView({ block: 'nearest' });
    announce('The current character frame is available below the garden.');
  });
  listen($('close-capture'), 'click', () => { $('capture-region').hidden = true; $('capture').focus({ preventScroll: true }); });
  listen($('capture-png'), 'click', () => {
    try {
      const link = document.createElement('a');
      link.download = `butterfly-${art.getGarden().scene}-${art.getStatus().tick}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      announce('A PNG of the garden has been prepared for download.');
    } catch { announce('This browser could not save the image. You can still capture the character frame.'); }
  });
  listen(narrow, 'change', () => { art.update(grid()); syncStatus(); });
  listen(document, 'visibilitychange', () => { if (document.hidden) stopStatus(); else { syncStatus(); startStatus(); } });
  listen(window, 'pagehide', event => { stopStatus(); if (!event.persisted) dispose(); });
  listen(window, 'pageshow', () => { if (!disposed) { art.resize(); syncStatus(); startStatus(); } });
  syncSettings();
  syncStatus();
  startStatus();
} catch (error) {
  dispose();
  reportError(error);
}
